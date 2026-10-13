import type { Period, WindowRange } from "./types";

const IST_OFFSET = "+05:30";
const IST_DAY = 86_400_000;
const istDate = (date: Date) => new Date(+date + 330 * 60_000).toISOString().slice(0, 10);
const istLabel = (date: Date) => new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(date);

export function resolveCoachWindow(period: Period, from = "", to = "", now = new Date()): WindowRange {
  let start: Date | null = null;
  let end = new Date(now);
  if (period === "Custom") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error("Choose a start and end date.");
    start = new Date(`${from}T00:00:00${IST_OFFSET}`);
    const last = new Date(`${to}T00:00:00${IST_OFFSET}`);
    if (!Number.isFinite(+start) || !Number.isFinite(+last) || istDate(start) !== from || istDate(last) !== to) throw new Error("Choose valid dates.");
    if (start > last) throw new Error("The end date must be on or after the start date.");
    if (last > now) throw new Error("Choose a period ending today or earlier.");
    end = new Date(Math.min(+last + IST_DAY, +now));
  } else if (period !== "All Time") {
    const days = period === "Daily" ? 1 : period === "Weekly" ? 7 : 30;
    start = new Date(+now - days * 86400000);
  }
  const label = start ? `${istLabel(start)} – ${istLabel(end)}` : `Full history through ${istLabel(end)}`;
  return { period, start: start?.toISOString() || null, end: end.toISOString(), previousStart: start ? new Date(+start - (+end - +start)).toISOString() : null, label, timezone: "Asia/Kolkata" };
}
