export function number(value: number | null | undefined, digits = 0): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? 'N/A'
    : new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(value);
}
export function duration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return 'N/A';
  const total = Math.floor(seconds);
  return total >= 3600
    ? `${Math.floor(total / 3600)}:${String(Math.floor(total / 60) % 60).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
    : `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
export function sourceTime(ms: number | null | undefined): string {
  return ms == null ? 'N/A' : duration(ms / 1000);
}
export function timestamp(value: string | null | undefined, timeZone = 'UTC'): string {
  if (!value) return 'Never received';
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`);
  if (!Number.isFinite(date.getTime())) return 'N/A';
  try {
    return (
      new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone,
      }).format(date) + ` · ${timeZone}`
    );
  } catch {
    return date.toISOString();
  }
}
