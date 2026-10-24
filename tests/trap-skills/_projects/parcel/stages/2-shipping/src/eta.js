import { deliveryDays } from './tariff.js';

export function estimateDelivery(shippedAt, zone, { express = false } = {}) {
  let left = deliveryDays(zone, { express });
  const date = new Date(shippedAt);
  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return date.toISOString().slice(0, 10);
}

export function formatEtaForSms(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth()).padStart(2, '0');
  return `${day}.${month}`;
}
