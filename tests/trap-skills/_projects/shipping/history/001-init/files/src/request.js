// Разбор тела котировки и отправления: вес, индекс, зона, опции (docs/api.md).
import { HttpError } from './errors.js';
import { parseWeight } from './parcel.js';
import { zoneFor } from './zones.js';

const MAX_GRAMS = 31500;

export function parseParcel(body = {}) {
  const weightGrams = parseWeight(body.weight);
  if (weightGrams <= 0 || weightGrams > MAX_GRAMS) throw new HttpError(400, 'вес: больше 0 и не больше 31,5 кг');
  const postcode = String(body.postcode ?? '');
  if (!/^\d{5}$/.test(postcode)) throw new HttpError(400, 'индекс: ожидается строка из 5 цифр');
  return {
    weightGrams,
    postcode,
    zone: zoneFor(postcode),
    express: body.express === true,
    currency: body.currency ?? 'EUR',
  };
}
