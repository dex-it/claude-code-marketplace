// Цена доставки: тариф зоны из config/tariffs.json, полоса по расчётному весу, надбавка за экспресс,
// пересчёт в валюту клиента (config/fx.json). Базовая валюта - EUR, округление до цента.
import { HttpError } from './errors.js';
import { readConfig } from './config.js';

const TARIFFS = readConfig('tariffs.json');
const FX = readConfig('fx.json');

const round2 = (x) => Math.round(x * 100) / 100;

export function quote({ weightGrams, zone, express = false, currency = 'EUR' }, tariffs = TARIFFS) {
  const tariff = tariffs.zones[zone];
  const grams = Math.ceil(weightGrams / 500) * 500; // расчётный вес - вверх до 0,5 кг
  let price = tariff.bands.find((b) => grams <= b.maxGrams).price;
  if (express) price += tariff.express;
  price = round2(price);
  if (currency !== 'EUR') {
    const rate = FX[currency];
    if (!rate) throw new HttpError(400, `валюта ${currency} не поддерживается`);
    price = round2(price * rate);
  }
  return { zone, billableKg: grams / 1000, price, currency };
}
