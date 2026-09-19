import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

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
      return (data ?? []) as TradingRule[];
    },
  });

  const addRule = useMutation({
    mutationFn: async (input: { rule: string; rule_type: string; threshold: number | null }) => {
      const rules = query.data ?? [];
      const { error } = await supabase.from("trading_rules").insert({
        user_id: uid,
        rule: input.rule,
        rule_type: input.rule_type,
        threshold: input.threshold,
        position: rules.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading_rules", uid] });
      toast({ title: "Rule added" });
    },
    onError: (e: Error) => toast({ title: "Failed to add rule", description: e.message, variant: "destructive" }),
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TradingRule> }) => {
      const { error } = await supabase.from("trading_rules").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trading_rules", uid] }),
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
      toast({ title: "Rule deleted" });
    },
    onError: (e: Error) => toast({ title: "Failed to delete rule", description: e.message, variant: "destructive" }),
  });

  return { rules: query.data ?? [], isLoading: query.isLoading, addRule, updateRule, deleteRule };
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rule_violations")
        .select("*")
        .eq("user_id", uid);
      if (error) throw error;
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
      if (currentlyFlagged) {
        // Delete
        const { error } = await supabase
          .from("rule_violations")
          .delete()
          .eq("rule_id", ruleId)
          .eq("violation_date", violationDate);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase.from("rule_violations").insert({
          user_id: uid,
          rule_id: ruleId,
          violation_date: violationDate,
          note: note ?? "",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rule_violations", uid] });
    },
    onError: (e: Error) => toast({ title: "Failed to toggle violation", description: e.message, variant: "destructive" }),
  });
}
