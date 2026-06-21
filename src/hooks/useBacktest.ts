import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BacktestSession, BacktestTrade } from "@/lib/backtest";

export function useBacktestSessions() {
  return useQuery({
    queryKey: ["backtest-sessions"],
    queryFn: async (): Promise<BacktestSession[]> => {
      const { data, error } = await supabase
        .from("backtest_sessions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BacktestSession[];
    },
  });
}

export function useBacktestSession(id: string | undefined) {
  return useQuery({
    queryKey: ["backtest-session", id],
    enabled: !!id,
    queryFn: async (): Promise<BacktestSession | null> => {
      const { data, error } = await supabase
        .from("backtest_sessions")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as BacktestSession | null;
    },
  });
}

export function useBacktestTrades(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["backtest-trades", sessionId],
    enabled: !!sessionId,
    queryFn: async (): Promise<BacktestTrade[]> => {
      const { data, error } = await supabase
        .from("backtest_trades")
        .select("*")
        .eq("session_id", sessionId!)
        .order("trade_date", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BacktestTrade[];
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backtest-sessions"] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backtest-sessions"] }),
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
      const { data: trades, error: e3 } = await supabase
        .from("backtest_trades")
        .select("*")
        .eq("session_id", id);
      if (e3) throw e3;
      if (trades && trades.length > 0) {
        const rows = trades.map((t: any) => {
          const { id: _i, created_at: _c, updated_at: _u, ...rest } = t;
          return { ...rest, session_id: copy.id, user_id: userRes.user!.id };
        });
        const { error: e4 } = await supabase.from("backtest_trades").insert(rows);
        if (e4) throw e4;
      }
      return copy as BacktestSession;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backtest-sessions"] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backtest-trades", sessionId] }),
  });
}

export function useUpdateTrade(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<BacktestTrade> & { id: string }) => {
      const { error } = await supabase.from("backtest_trades").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backtest-trades", sessionId] }),
  });
}

export function useDeleteTrade(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("backtest_trades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backtest-trades", sessionId] }),
  });
}

export function useBacktestAIReport(sessionId: string | undefined) {
  // No longer queries the database; use local state instead
  return useQuery({
    queryKey: ["backtest-ai-report", sessionId],
    enabled: false, // Disable since we don't fetch from DB anymore
    queryFn: async () => null,
  });
}

export function useGenerateBacktestAIReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.functions.invoke("backtest-ai", {
        body: { session_id: sessionId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (data, sessionId) => {
      // Set the report data directly into query cache so AIReportPanel can use it
      qc.setQueryData(["backtest-ai-report", sessionId], data?.report);
    },
  });
}
