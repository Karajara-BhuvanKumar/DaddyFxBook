import { supabase } from "@/integrations/supabase/client";
import type { CoachData } from "./types";

const PAGE_SIZE = 500;
/** All queries are user scoped and paginated. Never silently analyze a partial fetch. */
export async function fetchCoachData(userId: string, signal?: AbortSignal): Promise<CoachData> {
  type Table = "trades" | "journals" | "checklists" | "screenshots" | "trading_rules" | "rule_violations";
  async function read(table: Table) {
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      let query = supabase.from(table).select(table === "screenshots" ? "id,trade_id" : "*").eq("user_id", userId).order("id").range(offset, offset + PAGE_SIZE - 1);
      if (signal) query = query.abortSignal(signal);
      const { data, error } = await query;
      if (error) throw new Error(`Couldn't load ${table.replace(/_/g, " ")}. Please retry.`);
      rows.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) return rows;
    }
  }
  const tables = ["trades", "journals", "checklists", "screenshots", "trading_rules", "rule_violations"] as const;
  const result = await Promise.allSettled(tables.map(read));
  if (result[0].status === "rejected") throw result[0].reason;
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  const warnings: string[] = [];
  const get = (index: number) => {
    const item = result[index];
    if (item.status === "fulfilled") return item.value;
    warnings.push(`${tables[index].replace(/_/g, " ")} could not be loaded; this source is unavailable.`);
    return [];
  };
  return { trades: get(0), journals: get(1), checklists: get(2), screenshots: get(3), rules: get(4), violations: get(5), warnings } as CoachData;
}

