export function toISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
export function fmtYYYYMMDD(iso: string | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}
