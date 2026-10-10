import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchAllAnalysisRows } from "@/lib/fetchAllAnalysisRows";
import type { ExportData } from "@/lib/journalExport";
import { invalidateTradingData } from '@/lib/invalidateTradingData';
import { validateTrade } from '@/lib/tradeValidation';

export interface Trade {
  id: string;
  user_id: string;
  symbol: string;
  direction: string;
  entry_price: number;
  exit_price: number;
  lot_size: number;
  stop_loss: number | null;
  risk_pct?: number | null;
  take_profit: number | null;
  pnl: number;
  open_time: string;
  close_time: string;
  session: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface Journal {
  id: string;
  trade_id: string;
  user_id: string;
  pre_trade_notes: string | null;
  post_trade_notes: string | null;
  emotions: string | null;
  lessons: string | null;
  tags: string | null;
  rating: number | null;
  risk_reward: string | null;
  strategy_setup: string | null;
  created_at: string;
  updated_at: string;
}

export interface Checklist {
  id: string;
  trade_id: string;
  user_id: string;
  checked_higher_tf: boolean | null;
  risk_within_limits: boolean | null;
  fits_plan: boolean | null;
  key_levels: boolean | null;
  news_checked: boolean | null;
}

export function calculatePnl(direction: string, entryPrice: number, exitPrice: number, lotSize: number): number {
  const diff = direction === 'Long' ? exitPrice - entryPrice : entryPrice - exitPrice;
  return parseFloat((diff * lotSize * 100).toFixed(2));
}

export function useTrades() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['trades', user?.id],
    queryFn: async ({ signal }) => {
      const rows = await fetchAllAnalysisRows<Trade>(after => {
        let query = supabase.from('trades').select('*').eq('user_id', user!.id).order('id').limit(1000);
        if (after) query = query.gt('id', after);
        return query.abortSignal(signal);
      });
      return rows.sort((a, b) => Date.parse(b.close_time) - Date.parse(a.close_time));
    },
    enabled: !!user,
  });
}

export function useAddTrade() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (trade: { symbol: string; direction: string; entry_price: number; exit_price: number; lot_size: number; open_time: string; close_time: string; session?: string; risk_pct?: number | null }) => {
      if (!user) throw new Error('Not authenticated');
      validateTrade(trade);
      const pnl = calculatePnl(trade.direction, trade.entry_price, trade.exit_price, trade.lot_size);
      const { data, error } = await supabase
        .from('trades')
        .insert({ ...trade, pnl, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateTradingData(qc),
  });
}

export function useUpdateTrade() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      id,
      tradeData,
      journalData,
      checklistData
    }: {
      id: string;
      tradeData: Partial<Trade>;
      journalData?: Partial<Journal>;
      checklistData?: Partial<Checklist>;
    }) => {
      if (!user) throw new Error("Not authenticated");

      if (Object.keys(tradeData).length > 0) {
        if (tradeData.direction && tradeData.entry_price !== undefined && tradeData.exit_price !== undefined && tradeData.lot_size !== undefined && tradeData.open_time && tradeData.close_time) {
          validateTrade(tradeData as Trade);
          // Editing notes must not overwrite imported net P&L with gross XAUUSD P&L.
          const { data: original, error } = await supabase.from('trades').select('*').eq('id', id).eq('user_id', user.id).single();
          if (error) throw error;
          const pricesChanged = ['symbol', 'direction', 'entry_price', 'exit_price', 'lot_size'].some(key => tradeData[key as keyof Trade] !== undefined && tradeData[key as keyof Trade] !== original[key as keyof Trade]);
          if (pricesChanged) {
            if (tradeData.symbol !== 'XAUUSD') throw new Error('Automatic P&L calculation is available for XAUUSD only. You can still edit this trade’s journal.');
            tradeData.pnl = calculatePnl(tradeData.direction, tradeData.entry_price, tradeData.exit_price, tradeData.lot_size);
          }
        }
        const { error: tradeError } = await supabase
          .from('trades')
          .update(tradeData)
          .eq('id', id)
          .eq('user_id', user.id);
        if (tradeError) throw tradeError;
      }

      if (journalData && Object.keys(journalData).length > 0) {
        const { data: existingJournal, error: lookupError } = await supabase.from('journals').select('id').eq('trade_id', id).eq('user_id', user.id).maybeSingle();
        if (lookupError) throw lookupError;
        if (existingJournal) {
          const { error } = await supabase.from('journals').update(journalData).eq('id', existingJournal.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('journals').insert({ ...journalData, trade_id: id, user_id: user.id });
          if (error) throw error;
        }
        let setup: { market_session?: string } | null = null;
        try { setup = JSON.parse(journalData.strategy_setup || 'null'); } catch { /* Legacy free text. */ }
        if (setup && typeof setup.market_session === 'string') {
          const { error } = await supabase.from('trades').update({ session: setup.market_session || null }).eq('id', id).eq('user_id', user.id);
          if (error) throw new Error('Journal saved, but the market session could not be updated. Please save again.');
        }
      }

      if (checklistData && Object.keys(checklistData).length > 0) {
        const { data: existingChecklist, error: lookupError } = await supabase.from('checklists').select('id').eq('trade_id', id).eq('user_id', user.id).maybeSingle();
        if (lookupError) throw lookupError;
        if (existingChecklist) {
          const { error } = await supabase.from('checklists').update(checklistData).eq('id', existingChecklist.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('checklists').insert({ ...checklistData, trade_id: id, user_id: user.id });
          if (error) throw error;
        }
      }
    },
    onSettled: () => invalidateTradingData(qc),
  });
}

export function useDeleteTrade() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('trades').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => invalidateTradingData(qc),
  });
}

export function useDeleteTrades() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error('Not authenticated');
      for (let offset = 0; offset < ids.length; offset += 100) {
        const { error } = await supabase.from('trades').delete().eq('user_id', user.id).in('id', ids.slice(offset, offset + 100));
        if (error) throw error;
      }
    },
    onSettled: () => invalidateTradingData(qc),
  });
}

export function useJournal(tradeId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['journal', user?.id, tradeId],
    queryFn: async () => {
      if (!tradeId) return null;
      const { data, error } = await supabase
        .from('journals')
        .select('*')
        .eq('trade_id', tradeId)
        .maybeSingle();
      if (error) throw error;
      return data as Journal | null;
    },
    enabled: !!user && !!tradeId,
  });
}

export function useSaveJournal() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (journal: { trade_id: string; pre_trade_notes: string; post_trade_notes: string; emotions: string; lessons: string; tags: string; rating: number; risk_reward: string; strategy_setup: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { trade_id, ...updateFields } = journal;
      const existing = await supabase.from('journals').select('id').eq('trade_id', trade_id).maybeSingle();
      if (existing.error) {
        console.error('[useSaveJournal] lookup error:', { code: existing.error.code, message: existing.error.message, details: existing.error.details, hint: existing.error.hint });
        throw existing.error;
      }
      if (existing.data) {
        // Update — only send updatable fields, not trade_id
        const { error } = await supabase.from('journals').update(updateFields).eq('id', existing.data.id);
        if (error) {
          console.error('[useSaveJournal] update error:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
          throw error;
        }
      } else {
        // Insert — include trade_id and user_id
        const { error } = await supabase.from('journals').insert({ ...journal, user_id: user.id });
        if (error) {
          console.error('[useSaveJournal] insert error:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
          throw error;
        }
      }

      // A session-sync failure must remain visible; the user can retry the save.
      let setup: { market_session?: string } | null = null;
      try { setup = JSON.parse(journal.strategy_setup); } catch { /* Legacy free text. */ }
      if (setup && typeof setup.market_session === 'string') {
        const { error } = await supabase.from('trades').update({ session: setup.market_session || null }).eq('id', trade_id).eq('user_id', user.id);
        if (error) throw new Error('Journal saved, but the market session could not be updated. Please save again.');
      }
    },
    onSettled: () => invalidateTradingData(qc),
  });
}

export function useChecklist(tradeId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['checklist', user?.id, tradeId],
    queryFn: async () => {
      if (!tradeId) return null;
      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .eq('trade_id', tradeId)
        .maybeSingle();
      if (error) throw error;
      return data as Checklist | null;
    },
    enabled: !!user && !!tradeId,
  });
}

export function useSaveChecklist() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (checklist: { trade_id: string; checked_higher_tf: boolean; risk_within_limits: boolean; fits_plan: boolean; key_levels: boolean; news_checked: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      const existing = await supabase.from('checklists').select('id').eq('trade_id', checklist.trade_id).eq('user_id', user.id).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) {
        const { error } = await supabase.from('checklists').update(checklist).eq('id', existing.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('checklists').insert({ ...checklist, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateTradingData(qc),
  });
}

export function useScreenshots(tradeId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['screenshots', user?.id, tradeId],
    queryFn: async () => {
      if (!tradeId) return [];
      const { data, error } = await supabase
        .from('screenshots')
        .select('*')
        .eq('trade_id', tradeId);
      if (error) throw error;

      // image_url may be a storage path or a legacy public URL. Resolve to a signed URL.
      const withSigned = await Promise.all(
        (data ?? []).map(async (row) => {
          let path = row.image_url as string;
          const marker = '/object/public/screenshots/';
          if (path.includes(marker)) {
            path = decodeURIComponent(path.split(marker)[1]);
          }
          const { data: signed } = await supabase.storage
            .from('screenshots')
            .createSignedUrl(path, 3600);
          return { ...row, signed_url: signed?.signedUrl ?? '' };
        })
      );
      return withSigned;
    },
    enabled: !!user && !!tradeId,
  });
}

export function useUploadScreenshot() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ tradeId, file }: { tradeId: string; file: File }) => {
      const filePath = `${user!.id}/${tradeId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('screenshots').upload(filePath, file);
      if (uploadError) throw uploadError;
      // Store the storage path; signed URLs are generated on read.
      const { error } = await supabase.from('screenshots').insert({ trade_id: tradeId, user_id: user!.id, image_url: filePath });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['screenshots'] }),
  });
}

/** Read a complete, user-scoped snapshot. Never silently export only the first API page. */
export async function fetchExportData(userId: string, startDate?: string, endDate?: string): Promise<ExportData> {
  const read = (table: 'trades' | 'journals' | 'checklists' | 'screenshots') => fetchAllAnalysisRows(after => {
    let query = supabase.from(table).select('*').eq('user_id', userId).order('id').limit(500);
    if (after) query = query.gt('id', after);
    if (table === 'trades') {
      if (startDate) query = query.gte('open_time', startDate);
      if (endDate) query = query.lte('open_time', endDate);
    }
    return query;
  });
  const [trades, journals, checklists, screenshots] = await Promise.all([
    read('trades'), read('journals'), read('checklists'), read('screenshots'),
  ]);
  const ids = new Set(trades.map(t => t.id));
  return {
    trades: (trades as Trade[]).sort((a, b) => new Date(b.open_time).getTime() - new Date(a.open_time).getTime()),
    journals: (journals as Journal[]).filter(j => ids.has(j.trade_id)),
    checklists: (checklists as Checklist[]).filter(c => ids.has(c.trade_id)),
    screenshots: (screenshots as ExportData['screenshots']).filter(s => ids.has(s.trade_id)),
  };
}

/** Sign only the chosen report's images immediately before PDF generation. */
export async function resolveExportScreenshots(data: ExportData): Promise<ExportData> {
  const screenshots: ExportData['screenshots'] = [];
  for (let offset = 0; offset < data.screenshots.length; offset += 50) {
    const batch = data.screenshots.slice(offset, offset + 50);
    const paths = batch.map(row => {
      const marker = '/object/public/screenshots/';
      return row.image_url.includes(marker) ? decodeURIComponent(row.image_url.split(marker)[1]) : row.image_url;
    });
    const { data: signed } = await supabase.storage.from('screenshots').createSignedUrls(paths, 3600);
    screenshots.push(...batch.map((row, i) => ({ ...row, signed_url: signed?.[i]?.signedUrl || '' })));
  }
  return { ...data, screenshots };
}
export function usePublicTrade(tradeId: string | null) {
  return useQuery({
    queryKey: ['public-trade', tradeId],
    queryFn: async () => {
      if (!tradeId) return null;
      
      const { data: trade, error: tradeError } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .maybeSingle();
      if (tradeError) throw tradeError;
      if (!trade) return null;

      const { data: journal } = await supabase
        .from('journals')
        .select('*')
        .eq('trade_id', tradeId)
        .maybeSingle();

      const { data: rawScreenshots } = await supabase
        .from('screenshots')
        .select('*')
        .eq('trade_id', tradeId);

      const screenshots = await Promise.all(
        (rawScreenshots ?? []).map(async (row) => {
          let path = row.image_url as string;
          const marker = '/object/public/screenshots/';
          if (path.includes(marker)) {
            path = decodeURIComponent(path.split(marker)[1]);
          }
          const { data: signed } = await supabase.storage
            .from('screenshots')
            .createSignedUrl(path, 3600);
          return { ...row, signed_url: signed?.signedUrl ?? '' };
        })
      );

      return { trade: trade as Trade, journal: journal as Journal | null, screenshots };
    },
    enabled: !!tradeId,
  });
}

/**
 * Fetch all journals for the current user.
 * Used by the Analysis page to build "By Setup" breakdown
 * without loading journals one-by-one per trade.
 */
export function useAllJournals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['journals-all', user?.id],
    queryFn: ({ signal }) => fetchAllAnalysisRows<Journal>(after => {
      let query = supabase.from('journals').select('*').eq('user_id', user!.id).order('id').limit(1000);
      if (after) query = query.gt('id', after);
      return query.abortSignal(signal);
    }),
    enabled: !!user,
  });
}
