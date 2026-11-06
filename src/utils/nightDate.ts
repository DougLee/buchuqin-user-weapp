/** Night order timestamps always use the campus business timezone. */
export function nightDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  const shifted = new Date(d.getTime() + 8 * 3600000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())} ${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}`;
}
