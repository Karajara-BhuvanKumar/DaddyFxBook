import type { Period, WindowRange } from "./types";
import { localHourToUtc, zonedDateKey } from "../marketTime";

export function resolveCoachWindow(period: Period, from = "", to = "", now = new Date(), timezone = "Asia/Kolkata"): WindowRange {
  let start: Date | null = null;
  let end = new Date(now);
  if (period === "Custom") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error("Choose a start and end date.");
    const firstDay = Date.parse(`${from}T00:00:00Z`), lastDay = Date.parse(`${to}T00:00:00Z`);
    if (![firstDay, lastDay].every(Number.isFinite) || new Date(firstDay).toISOString().slice(0, 10) !== from || new Date(lastDay).toISOString().slice(0, 10) !== to) throw new Error("Choose valid dates.");
    if (from > to) throw new Error("The end date must be on or after the start date.");
    if (to > zonedDateKey(now, timezone)) throw new Error("Choose a period ending today or earlier.");
    start = new Date(localHourToUtc(firstDay, 0, timezone));
    end = new Date(Math.min(localHourToUtc(lastDay + 86400000, 0, timezone), +now));
  } else if (period !== "All Time") {
    const days = period === "Daily" ? 1 : period === "Weekly" ? 7 : 30;
    start = new Date(+now - days * 86400000);
  }
  const format = (date: Date) => new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date);
  const label = start ? `${format(start)} – ${format(end)}` : `Full history through ${format(end)}`;
  return { period, start: start?.toISOString() || null, end: end.toISOString(), previousStart: start ? new Date(+start - (+end - +start)).toISOString() : null, label, timezone };
}
