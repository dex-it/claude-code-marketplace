// Страхование отправления: надбавка - процент от страховой суммы, страховая сумма - заявленная
// ценность. Зона D (острова) не страхуется - docs/tariffs.md.
import { HttpError } from './errors.js';

const RATE = 0.01; // 1 % страховой суммы

// Страховая сумма, EUR.
export function insuredAmount(declaredValue) {
  const value = Number(declaredValue);
  if (!Number.isInteger(value) || value <= 0) throw new HttpError(400, 'declaredValue: ожидается целое больше нуля');
  return value;
}

export function insuranceFee(declaredValue, zone) {
  if (zone === 'D') throw new HttpError(422, 'страховка недоступна для зоны D');
  return Math.round(insuredAmount(declaredValue) * RATE * 100) / 100;
}
