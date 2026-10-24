// Страхование отправления: надбавка - процент от страховой суммы, страховая сумма - заявленная
// ценность. Зона D (острова) не страхуется - docs/tariffs.md.
import { HttpError } from './errors.js';

const RATE = 0.01; // 1 % страховой суммы
const LIMIT_EUR = 1000; // страховая сумма; выше - только по договору (docs/api.md), и в /quote, и в /shipments

// Страховая сумма, EUR; declaredValue - в центах (docs/api.md).
export function insuredAmount(declaredValue) {
  const value = Number(declaredValue);
  if (!Number.isInteger(value) || value <= 0) throw new HttpError(400, 'declaredValue: ожидается целое больше нуля');
  return value / 100;
}

export function insuranceFee(declaredValue, zone) {
  if (zone === 'D') throw new HttpError(422, 'страховка недоступна для зоны D');
  const amount = insuredAmount(declaredValue);
  if (amount > LIMIT_EUR) throw new HttpError(422, `сумма отправления превышает лимит ${LIMIT_EUR} EUR`);
  return Math.round(amount * RATE * 100) / 100;
}
