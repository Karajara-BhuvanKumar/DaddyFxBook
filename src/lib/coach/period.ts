import { format, addDays } from "date-fns";
import type { Period, WindowRange } from "./types";

export function resolveCoachWindow(period: Period, from = "", to = "", now = new Date()): WindowRange {
  let start: Date | null = null;
  let end = new Date(now);
  if (period === "Custom") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error("Choose a start and end date.");
    start = new Date(`${from}T00:00:00`);
    const last = new Date(`${to}T00:00:00`);
    if (!Number.isFinite(+start) || !Number.isFinite(+last) || format(start, "yyyy-MM-dd") !== from || format(last, "yyyy-MM-dd") !== to) throw new Error("Choose valid dates.");
    if (start > last) throw new Error("The end date must be on or after the start date.");
    if (last > now) throw new Error("Choose a period ending today or earlier.");
    end = new Date(Math.min(+addDays(last, 1), +now));
  } else if (period !== "All Time") {
    const days = period === "Daily" ? 1 : period === "Weekly" ? 7 : 30;
    start = new Date(+now - days * 86400000);
  }
  const label = start ? `${format(start, "dd MMM yyyy, HH:mm")} – ${format(end, "dd MMM yyyy, HH:mm")}` : `Full history through ${format(end, "dd MMM yyyy, HH:mm")}`;
  return { period, start: start?.toISOString() || null, end: end.toISOString(), previousStart: start ? new Date(+start - (+end - +start)).toISOString() : null, label, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}
