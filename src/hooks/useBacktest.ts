import { useAuth } from '@/hooks/useAuth';
import { fetchAllAnalysisRows } from '@/lib/fetchAllAnalysisRows';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseEdgeFunctionError } from "@/lib/edgeFunctions";
import type { BacktestSession, BacktestTrade } from "@/lib/backtest";

export function useBacktestSessions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["backtest-sessions", user?.id], enabled: !!user,
    queryFn: async ({ signal }): Promise<BacktestSession[]> => {
      const rows = await fetchAllAnalysisRows<BacktestSession>(after => {
        let query = supabase.from('backtest_sessions').select('*').eq('user_id', user!.id).order('id').limit(1000);
        if (after) query = query.gt('id', after);
        return query.abortSignal(signal);
      });
      return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
  });
}

export function useBacktestSession(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["backtest-session", id, user?.id], enabled: !!id && !!user,
    queryFn: async (): Promise<BacktestSession | null> => {
      const { data, error } = await supabase.from('backtest_sessions').select('*').eq('id', id!).eq('user_id', user!.id).maybeSingle();
      if (error) throw error;
      return data as BacktestSession | null;
    },
  });
}

export function useBacktestTrades(sessionId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["backtest-trades", sessionId, user?.id], enabled: !!sessionId && !!user,
    queryFn: async ({ signal }): Promise<BacktestTrade[]> => {
      const rows = await fetchAllAnalysisRows<BacktestTrade>(async after => {
        let query = supabase.from('backtest_trades').select('*').eq('user_id', user!.id).eq('session_id', sessionId!).order('id').limit(1000);
        if (after) query = query.gt('id', after);
        const result = await query.abortSignal(signal);
        return { data: result.data as BacktestTrade[] | null, error: result.error };
      });
      return rows.sort((a, b) => (a.trade_date || a.created_at).localeCompare(b.trade_date || b.created_at) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    },
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; pair?: string; strategy?: string; description?: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("backtest_sessions")
        .insert({ ...input, user_id: userRes.user.id })
        .select()
        .single();
      if (error) throw error;
      return data as BacktestSession;
    },
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ["backtest-sessions"] }),
      qc.invalidateQueries({ queryKey: ["performance-coach-data"] }),
    ]),
  });
}

export function useUpdateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<BacktestSession> & { id: string }) => {
      const { error } = await supabase.from("backtest_sessions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["backtest-sessions"] });
      qc.invalidateQueries({ queryKey: ["backtest-session", vars.id] });
    },
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("backtest_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ["backtest-sessions"] }),
      qc.invalidateQueries({ queryKey: ["performance-coach-data"] }),
    ]),
  });
}

export function useDuplicateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not authenticated");
      const { data: orig, error: e1 } = await supabase
        .from("backtest_sessions")
        .select("*")
        .eq("id", id)
        .single();
      if (e1) throw e1;
      const trades = await fetchAllAnalysisRows<BacktestTrade>(async after => {
        let query = supabase.from('backtest_trades').select('*').eq('session_id', id).eq('user_id', userRes.user!.id).order('id').limit(1000);
        if (after) query = query.gt('id', after);
        const result = await query;
        return { data: result.data as BacktestTrade[] | null, error: result.error };
      });
      const { data: copy, error: e2 } = await supabase
        .from("backtest_sessions")
        .insert({
          user_id: userRes.user.id,
          name: `${orig.name} (copy)`,
          pair: orig.pair,
          strategy: orig.strategy,
          description: orig.description,
        })
        .select()
        .single();
      if (e2) throw e2;
      if (trades && trades.length > 0) {
        const rows = trades.map((t: any) => {
          const { id: _i, created_at: _c, updated_at: _u, ...rest } = t;
          return { ...rest, session_id: copy.id, user_id: userRes.user!.id };
        });
        const { error: e4 } = await supabase.from("backtest_trades").insert(rows);
        if (e4) {
          const cleanup = await supabase.from('backtest_sessions').delete().eq('id', copy.id).eq('user_id', userRes.user.id);
          if (cleanup.error) { await qc.invalidateQueries({ queryKey: ['backtest-sessions'] }); throw new Error('The copy is incomplete. Please remove the empty copy before trying again.'); }
          throw e4;
        }
      }
      return copy as BacktestSession;
    },
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ["backtest-sessions"] }),
      qc.invalidateQueries({ queryKey: ["performance-coach-data"] }),
    ]),
  });
}

export function useCreateTrade(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<BacktestTrade>) => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("backtest_trades")
        .insert({ ...input, session_id: sessionId, user_id: userRes.user.id } as any);
      if (error) throw error;
    },
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ["backtest-trades", sessionId] }),
      qc.invalidateQueries({ queryKey: ["performance-coach-data"] }),
    ]),
  });
}

export function useUpdateTrade(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<BacktestTrade> & { id: string }) => {
      const { error } = await supabase.from("backtest_trades").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ["backtest-trades", sessionId] }),
      qc.invalidateQueries({ queryKey: ["performance-coach-data"] }),
    ]),
  });
}

export function useDeleteTrade(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("backtest_trades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ["backtest-trades", sessionId] }),
      qc.invalidateQueries({ queryKey: ["performance-coach-data"] }),
    ]),
  });
}

export function useBacktestAIReport(sessionId: string | undefined) {
  const { user } = useAuth();
  // No longer queries the database; use local state instead
  return useQuery({
    queryKey: ["backtest-ai-report", sessionId, user?.id],
    enabled: false, // Disable since we don't fetch from DB anymore
    queryFn: async () => null,
  });
}

export function useGenerateBacktestAIReport() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.functions.invoke("backtest-ai", {
        body: { session_id: sessionId },
      });
      if (error || (data as any)?.error) {
        throw await parseEdgeFunctionError(error, data);
      }
      return data;
    },
    onSuccess: (data, sessionId) => {
      // Set the report data directly into query cache so AIReportPanel can use it
      qc.setQueryData(["backtest-ai-report", sessionId, user?.id], data?.report);
    },
  });
}
