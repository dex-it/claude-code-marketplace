// Вес посылки в целых граммах из того, что прислал клиент; форматы - docs/api.md.
import { HttpError } from './errors.js';

const WITH_UNIT = /^(\d+(?:[.,]\d+)?)\s*(kg|g)$/i;

export function parseWeight(input) {
  if (typeof input === 'number') return Math.round(input * 1000);
  const m = WITH_UNIT.exec(String(input ?? '').trim());
  if (!m) throw new HttpError(400, `вес: неизвестный формат "${input}"`);
  const value = Number(m[1].replace(',', '.'));
  return Math.round(m[2].toLowerCase() === 'g' ? value : value * 1000);
}
