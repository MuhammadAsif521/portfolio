// UTC so SSR and the browser print the same date whatever their time zones.
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "2026-09-01T…" → { label: "Sep 1, 2026", iso: "2026-09-01" }; null for missing or bad dates. */
export function dayMonthYear(value: string | undefined): { label: string; iso: string } | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { label: DAY_MONTH_YEAR.format(date), iso: date.toISOString().slice(0, 10) };
}
