import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { AIReport, TradeReview, Grade } from "@/components/ai-report/types";

export interface PersistedReport {
  id: string;
  report: AIReport;
  stats: Record<string, unknown> | null;
  trade_count: number;
  created_at: string;
}

export interface PersistedTradeReview {
  id: string;
  trade_id: string;
  grade: Grade;
  went_right: string[];
  went_wrong: string[];
  improvements: string[];
  summary: string;
  updated_at: string;
}

export function useLatestReport() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ai_performance_report", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_performance_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as PersistedReport | null;
    },
  });
}

export function useTradeReviews() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ai_trade_reviews", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_trade_reviews")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PersistedTradeReview[];
    },
  });
}

export function useTradeReview(tradeId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ai_trade_review", tradeId],
    enabled: !!user && !!tradeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_trade_reviews")
        .select("*")
        .eq("trade_id", tradeId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as PersistedTradeReview | null;
    },
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opts?: { mode?: "full" | "single"; trade_id?: string }) => {
      const { data, error } = await supabase.functions.invoke("ai-report", {
        body: { mode: opts?.mode ?? "full", trade_id: opts?.trade_id },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as { report: AIReport; stats: unknown };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_performance_report"] });
      qc.invalidateQueries({ queryKey: ["ai_trade_reviews"] });
      qc.invalidateQueries({ queryKey: ["ai_trade_review"] });
    },
  });
}
