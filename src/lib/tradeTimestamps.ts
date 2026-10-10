/** datetime-local controls display wall time; the database stores absolute instants. */
export function toLocalDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toUtcTimestamp(value: string, original?: string): string {
  // Saving unrelated fields must not truncate seconds or shift ambiguous DST times.
  if (original && toLocalDateTime(original) === value) return original;
  if (!value.trim()) throw new Error('A valid trade date and time is required.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('A valid trade date and time is required.');
  return date.toISOString();
}
