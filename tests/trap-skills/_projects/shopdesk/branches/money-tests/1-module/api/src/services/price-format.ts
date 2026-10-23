const NBSP = ' ';

export function formatKopecks(kopecks: number): string {
  const sign = kopecks < 0 ? '-' : '';
  const abs = Math.abs(Math.round(kopecks));
  const rubles = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const rest = (abs % 100).toString().padStart(2, '0');
  return `${sign}${rubles},${rest}${NBSP}₽`;
}

// Делит сумму на равные части в копейках; остаток по копейке уходит первым частям.
export function splitEvenly(totalKopecks: number, parts: number): number[] {
  if (!Number.isInteger(parts) || parts < 1) throw new RangeError('parts must be a positive integer');
  const base = Math.floor(totalKopecks / parts);
  const remainder = totalKopecks - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}
