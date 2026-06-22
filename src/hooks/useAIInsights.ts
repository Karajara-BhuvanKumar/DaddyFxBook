import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ScorecardSnapshot } from "@/lib/scoring";
import type { PeriodType, PeriodStats } from "@/lib/periodStats";

export interface PeriodReportRecord {
  id: string;
  period_type: PeriodType;
  period_start: string;
  period_end: string;
  trade_count: number;
  stats: PeriodStats;
  report: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ScorecardRecord {
  id: string;
  discipline_score: number;
  risk_score: number;
  execution_score: number;
  psychology_score: number;
  consistency_score: number;
  overall_score: number;
  classification: string;
  trade_count: number;
  breakdown: ScorecardSnapshot;
  ai_insights: {
    overall_summary: string;
    categories: Record<
      "discipline" | "risk" | "execution" | "psychology" | "consistency",
      { explanation: string; recommendations: string[] }
    >;
  } | null;
  created_at: string;
}

/**
 * Returns true if the Supabase error indicates the table does not exist.
 */
function isTableMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return code === "42P01" || code === "PGRST116";
}

function toISODate(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function usePeriodReport(periodType: PeriodType, periodStart: Date | null) {
  const { user } = useAuth();
  const key = periodStart ? toISODate(periodStart) : null;
  return useQuery({
    queryKey: ["ai_period_report", periodType, key],
    enabled: !!user && !!key,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_period_reports")
        .select("*")
        .eq("period_type", periodType)
        .eq("period_start", key!)
        .maybeSingle();
      if (error) {
        if (isTableMissing(error)) return null;
        throw error;
      }
      return data as unknown as PeriodReportRecord | null;
    },
  });
}

export function useGeneratePeriodReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      period_type: PeriodType;
      period_start: Date;
      period_end: Date;
      stats: PeriodStats;
      trades: Array<Record<string, unknown>>;
    }) => {
      const { data, error } = await supabase.functions.invoke("ai-insights", {
        body: {
          mode: "period",
          period_type: input.period_type,
          period_start: toISODate(input.period_start),
          period_end: toISODate(input.period_end),
          stats: input.stats,
          trades: input.trades,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as { report: Record<string, unknown> };
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["ai_period_report", vars.period_type, toISODate(vars.period_start)] }),
  });
}

export function useLatestScorecard() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ai_scorecard_latest", user?.id],
    enabled: !!user,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_scorecards")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        if (isTableMissing(error)) return null;
        throw error;
      }
      return data as unknown as ScorecardRecord | null;
    },
  });
}

export function useScorecardHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ai_scorecard_history", user?.id],
    enabled: !!user,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_scorecards")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(60);
      if (error) {
        if (isTableMissing(error)) return [];
        throw error;
      }
      return (data ?? []) as unknown as ScorecardRecord[];
    },
  });
}

export function useGenerateScorecard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      snapshot: ScorecardSnapshot;
      trade_count: number;
      trades_summary: unknown;
    }) => {
      const { data, error } = await supabase.functions.invoke("ai-insights", {
        body: {
          mode: "scorecard",
          snapshot: input.snapshot,
          trade_count: input.trade_count,
          trades_summary: input.trades_summary,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_scorecard_latest"] });
      qc.invalidateQueries({ queryKey: ["ai_scorecard_history"] });
    },
  });
}
