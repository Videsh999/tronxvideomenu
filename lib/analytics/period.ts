/** Day-boundary helpers for analytics (default Asia/Kolkata). */

export function restaurantTimezone(explicit?: string): string {
  return explicit && explicit.length > 0 ? explicit : "Asia/Kolkata";
}

/** YYYY-MM-DD in the given IANA timezone. */
export function localDateKey(iso: string, timeZone = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function startOfLocalDayIso(dateKey: string, timeZone = "Asia/Kolkata"): string {
  // Interpret dateKey as local midnight via iterative offset (sufficient for TRONX day buckets).
  const probe = new Date(`${dateKey}T00:00:00.000Z`);
  const asLocal = localDateKey(probe.toISOString(), timeZone);
  const diffDays =
    (Date.parse(`${dateKey}T00:00:00Z`) - Date.parse(`${asLocal}T00:00:00Z`)) / 86_400_000;
  const adjusted = new Date(probe.getTime() + diffDays * 86_400_000);
  // Refine once
  const again = localDateKey(adjusted.toISOString(), timeZone);
  if (again !== dateKey) {
    const nudge = again < dateKey ? 86_400_000 : -86_400_000;
    return new Date(adjusted.getTime() + nudge).toISOString();
  }
  return adjusted.toISOString();
}

export function addLocalDays(dateKey: string, days: number): string {
  const base = new Date(`${dateKey}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function isCompleteLocalDay(dateKey: string, now = new Date(), timeZone = "Asia/Kolkata"): boolean {
  const today = localDateKey(now.toISOString(), timeZone);
  return dateKey < today;
}

export function weekdayIndex(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();
}
