import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Trade {
  id: string;
  user_id: string;
  symbol: string;
  direction: string;
  entry_price: number;
  exit_price: number;
  lot_size: number;
  stop_loss: number | null;
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .order('close_time', { ascending: false });
      if (error) throw error;
      return data as Trade[];
    },
    enabled: !!user,
  });
}

export function useAddTrade() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (trade: { symbol: string; direction: string; entry_price: number; exit_price: number; lot_size: number; open_time: string; close_time: string; session?: string }) => {
      const pnl = calculatePnl(trade.direction, trade.entry_price, trade.exit_price, trade.lot_size);
      const { data, error } = await supabase
        .from('trades')
        .insert({ ...trade, pnl, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trades'] }),
  });
}

export function useDeleteTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trades').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trades'] }),
  });
}

export function useJournal(tradeId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['journal', tradeId],
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
      const existing = await supabase.from('journals').select('id').eq('trade_id', journal.trade_id).maybeSingle();
      if (existing.data) {
        const { error } = await supabase.from('journals').update(journal).eq('id', existing.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('journals').insert({ ...journal, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journal'] }),
  });
}

export function useChecklist(tradeId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['checklist', tradeId],
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
      const existing = await supabase.from('checklists').select('id').eq('trade_id', checklist.trade_id).maybeSingle();
      if (existing.data) {
        const { error } = await supabase.from('checklists').update(checklist).eq('id', existing.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('checklists').insert({ ...checklist, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist'] }),
  });
}

export function useScreenshots(tradeId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['screenshots', tradeId],
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

export async function fetchExportData(userId: string, startDate?: string, endDate?: string) {
  let tradesQuery = supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('close_time', { ascending: false });

  if (startDate) tradesQuery = tradesQuery.gte('open_time', startDate);
  if (endDate) tradesQuery = tradesQuery.lte('open_time', endDate);

  const { data: trades, error: tradesError } = await tradesQuery;
  if (tradesError) throw tradesError;

  if (!trades || trades.length === 0) return { trades: [], journals: [], checklists: [], screenshots: [] };

  const tradeIds = trades.map(t => t.id);

  // Since Supabase has a limit on 'in' clause, we should chunk it if necessary, but 
  // typically a user exports a reasonable amount. If very large, chunking is needed.
  // We will fetch all and filter client side if the number of trades is huge, 
  // but let's try the simple approach first for journals and checklists.

  const [journalsRes, checklistsRes, screenshotsRes] = await Promise.all([
    supabase.from('journals').select('*').in('trade_id', tradeIds),
    supabase.from('checklists').select('*').in('trade_id', tradeIds),
    supabase.from('screenshots').select('*').in('trade_id', tradeIds),
  ]);

  if (journalsRes.error) throw journalsRes.error;
  if (checklistsRes.error) throw checklistsRes.error;
  if (screenshotsRes.error) throw screenshotsRes.error;

  const journals = journalsRes.data as Journal[];
  const checklists = checklistsRes.data as Checklist[];
  const rawScreenshots = screenshotsRes.data as any[];

  // Generate signed URLs for screenshots
  const screenshots = await Promise.all(
    rawScreenshots.map(async (row) => {
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

  return { trades, journals, checklists, screenshots };
}

