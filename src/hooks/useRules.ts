import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { isSchemaMismatchError } from "@/lib/supabaseErrors";

// ---------------------------------------------------------------------------
// Types (local — mirrors DB row shapes)
// ---------------------------------------------------------------------------

export interface TradingRule {
  id: string;
  user_id: string;
  rule: string;
  active: boolean;
  position: number;
  rule_type: string;
  threshold: number | null;
  created_at: string;
  updated_at: string;
}

export interface RuleViolationRow {
  id: string;
  user_id: string;
  rule_id: string;
  violation_date: string;
  note: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// useRulesSchemaStatus — probe query for missing columns/tables
// ---------------------------------------------------------------------------

export function useRulesSchemaStatus() {
  const query = useQuery({
    queryKey: ["rules_schema_status"],
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      let outdated = false;
      try {
        const { error: rulesError } = await supabase.from("trading_rules").select("rule_type,threshold").limit(1);
        if (rulesError && isSchemaMismatchError(rulesError)) outdated = true;
      } catch (e) {
        if (isSchemaMismatchError(e)) outdated = true;
      }

      try {
        const { error: violationsError } = await supabase.from("rule_violations").select("id").limit(1);
        if (violationsError && isSchemaMismatchError(violationsError)) outdated = true;
      } catch (e) {
        if (isSchemaMismatchError(e)) outdated = true;
      }
      return { outdated };
    }
  });

  return {
    outdated: query.data?.outdated ?? false,
    isChecking: query.isLoading,
  };
}

// ---------------------------------------------------------------------------
// useRules — query + CRUD mutations
// ---------------------------------------------------------------------------

export function useRules() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["trading_rules", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trading_rules")
        .select("*")
        .eq("user_id", uid)
        .order("position");
      if (error) throw error;
      return (data ?? []).map(row => ({
        ...row,
        rule_type: row.rule_type ?? 'manual',
        threshold: row.threshold ?? null,
      })) as TradingRule[];
    },
  });

  const addRule = useMutation({
    mutationFn: async (input: { rule: string; rule_type: string; threshold: number | null }) => {
      const rules = query.data ?? [];
      try {
        const { error } = await supabase.from("trading_rules").insert({
          user_id: uid,
          rule: input.rule,
          rule_type: input.rule_type,
          threshold: input.threshold,
          position: rules.length,
        });
        if (error) throw error;
      } catch (error) {
        if (isSchemaMismatchError(error)) {
          if (input.rule_type === 'manual') {
            // Fallback for old schema
            const { error: fallbackError } = await supabase.from("trading_rules").insert({
              user_id: uid,
              rule: input.rule,
              position: rules.length,
            });
            if (fallbackError) throw fallbackError;
            return;
          } else {
            throw new Error("Database update required: run the latest migration to enable automatic rules.");
          }
        }
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading_rules", uid] });
      qc.invalidateQueries({ queryKey: ["rules_schema_status"] });
      qc.invalidateQueries({ queryKey: ["performance-coach-data"] });
      toast({ title: "Rule added" });
    },
    onError: (e: Error) => toast({ title: "Failed to add rule", description: e.message, variant: "destructive" }),
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TradingRule> }) => {
      const { error } = await supabase.from("trading_rules").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ["trading_rules", uid] }), qc.invalidateQueries({ queryKey: ["performance-coach-data"] })]),
    onError: (e: Error) => toast({ title: "Failed to update rule", description: e.message, variant: "destructive" }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trading_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading_rules", uid] });
      qc.invalidateQueries({ queryKey: ["rule_violations", uid] });
      qc.invalidateQueries({ queryKey: ["performance-coach-data"] });
      toast({ title: "Rule deleted" });
    },
    onError: (e: Error) => toast({ title: "Failed to delete rule", description: e.message, variant: "destructive" }),
  });

  return { rules: query.data ?? [], isLoading: query.isLoading, error: query.error, refetch: query.refetch, addRule, updateRule, deleteRule };
}

// ---------------------------------------------------------------------------
// useRuleViolations — manual flags
// ---------------------------------------------------------------------------

export function useRuleViolations() {
  const { user } = useAuth();
  const uid = user?.id ?? "";

  return useQuery({
    queryKey: ["rule_violations", uid],
    enabled: !!uid,
    retry: false, // Do not retry if we hit a 404/schema error
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rule_violations")
        .select("*")
        .eq("user_id", uid);
      if (error) {
        if (isSchemaMismatchError(error)) {
          console.warn("rule_violations table not found; returning empty violations.");
          return [];
        }
        throw error;
      }
      return (data ?? []) as RuleViolationRow[];
    },
  });
}

// ---------------------------------------------------------------------------
// useToggleRuleViolation — insert or delete a manual flag
// ---------------------------------------------------------------------------

export function useToggleRuleViolation() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ruleId,
      violationDate,
      currentlyFlagged,
      note,
    }: {
      ruleId: string;
      violationDate: string;
      currentlyFlagged: boolean;
      note?: string;
    }) => {
      let error;
      if (currentlyFlagged) {
        // Delete
        const res = await supabase
          .from("rule_violations")
          .delete()
          .eq("rule_id", ruleId)
          .eq("violation_date", violationDate);
        error = res.error;
      } else {
        // Insert
        const res = await supabase.from("rule_violations").insert({
          user_id: uid,
          rule_id: ruleId,
          violation_date: violationDate,
          note: note ?? "",
        });
        error = res.error;
      }
      if (error) {
        if (isSchemaMismatchError(error)) {
          throw new Error("Database update required: run the latest migration to enable automatic rules.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rule_violations", uid] });
      qc.invalidateQueries({ queryKey: ["performance-coach-data"] });
    },
    onError: (e: Error) => toast({ title: "Failed to toggle violation", description: e.message, variant: "destructive" }),
  });
}
