/**
 * Central timezone module for DaddyFxBook.
 * ALL timezone-sensitive logic MUST live here.
 * The app uses Asia/Kolkata (IST, UTC+5:30) for every date/time
 * shown, entered, grouped, filtered, or exported.
 * Stored data stays UTC timestamptz in the database.
 */

export const APP_TIMEZONE = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  weekday: "short",
});

function toDate(input: string | Date): Date {
  return typeof input === "string" ? new Date(input) : input;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// ---------------------------------------------------------------------------
// Day key  (YYYY-MM-DD in IST)
// ---------------------------------------------------------------------------

/** Convert an ISO timestamp or Date to a YYYY-MM-DD string in IST. */
export function istDayKey(input: string | Date): string {
  return dayKeyFmt.format(toDate(input));
}

// ---------------------------------------------------------------------------
// Day of week (Monday = 0 … Sunday = 6)
// ---------------------------------------------------------------------------

const DOW_MAP: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

/** Return Monday-based day-of-week index (Mon=0..Sun=6) in IST. */
export function istDayOfWeek(input: string | Date): number {
  const d = toDate(input);
  const parts = partsFmt.formatToParts(d);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  return DOW_MAP[wd] ?? 0;
}

// ---------------------------------------------------------------------------
// Current IST components
// ---------------------------------------------------------------------------

export interface IstNowResult {
  year: number;
  month: number; // 0-11
  day: number;
  hours: number;
  minutes: number;
}

/** Return the current year/month/day/hours/minutes in IST. */
export function istNow(): IstNowResult {
  const now = new Date();
  const parts = partsFmt.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const v = parts.find((p) => p.type === type)?.value ?? "0";
    return parseInt(v, 10);
  };
  return {
    year: get("year"),
    month: get("month") - 1, // 0-based
    day: get("day"),
    hours: get("hour"),
    minutes: get("minute"),
  };
}

/** Return today's YYYY-MM-DD in IST. */
export function istTodayKey(): string {
  return istDayKey(new Date());
}

// ---------------------------------------------------------------------------
// IST day boundaries (real UTC instants)
// ---------------------------------------------------------------------------

/**
 * Return a Date representing 00:00:00.000 IST of the given day key.
 * This is a real UTC instant (the IST midnight, expressed in UTC).
 */
export function startOfIstDay(dayKey: string): Date {
  // dayKey = "YYYY-MM-DD"; IST midnight = dayKey + "T00:00:00+05:30"
  return new Date(`${dayKey}T00:00:00${IST_OFFSET}`);
}

/**
 * Return a Date representing the end of the IST day (start of next day).
 */
export function endOfIstDay(dayKey: string): Date {
  const start = startOfIstDay(dayKey);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

type FormatIstOptions = Intl.DateTimeFormatOptions;

/**
 * Format a date/ISO string in IST with the given Intl options.
 * Automatically injects `timeZone: "Asia/Kolkata"`.
 */
export function formatIst(
  input: string | Date,
  options: FormatIstOptions = { month: "short", day: "numeric" },
): string {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: APP_TIMEZONE,
  }).format(toDate(input));
}

// ---------------------------------------------------------------------------
// Datetime-local input helpers
// ---------------------------------------------------------------------------

/**
 * Convert an ISO timestamp to a "YYYY-MM-DDThh:mm" string in IST
 * suitable for <input type="datetime-local">.
 */
export function toIstInputValue(iso: string | Date): string {
  const d = toDate(iso);
  const n = istNowFromDate(d);
  return `${n.year}-${pad2(n.month + 1)}-${pad2(n.day)}T${pad2(n.hours)}:${pad2(n.minutes)}`;
}

/** Internal: extract IST parts from any date (not just "now"). */
function istNowFromDate(d: Date): IstNowResult {
  const parts = partsFmt.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const v = parts.find((p) => p.type === type)?.value ?? "0";
    return parseInt(v, 10);
  };
  return {
    year: get("year"),
    month: get("month") - 1,
    day: get("day"),
    hours: get("hour"),
    minutes: get("minute"),
  };
}

/**
 * Convert a datetime-local value ("YYYY-MM-DDThh:mm") interpreted as IST
 * to a full ISO UTC string. Safe: never calls `new Date()` on a naive string.
 */
export function fromIstInputValue(value: string): string {
  // Append seconds and IST offset, then let Date parse the unambiguous string
  const iso = `${value}:00${IST_OFFSET}`;
  return new Date(iso).toISOString();
}

/**
 * Return the current IST time formatted for a datetime-local input.
 */
export function istInputNow(): string {
  return toIstInputValue(new Date());
}
