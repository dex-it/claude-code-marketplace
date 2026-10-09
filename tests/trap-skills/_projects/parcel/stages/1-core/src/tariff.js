export class TariffError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TariffError';
    this.code = code;
  }
}

const MIN_WEIGHT_KG = 0.1;
const MAX_WEIGHT_KG = 30;
const RATE_PER_UNIT_KOPECKS = { A: 12000, B: 15000, C: 21000 };
const FRAGILE_KOPECKS = 30000;
const STANDARD_DAYS = { A: 1, B: 3, C: 5 };
const EXPRESS_DAYS = { A: 1, B: 2, C: 3 };

export function zoneForPostcode(postcode) {
  if (typeof postcode !== 'string' || !/^\d{6}$/.test(postcode)) {
    throw new TariffError('POSTCODE', `Некорректный индекс: ${postcode}`);
  }
  if (postcode.startsWith('1')) return 'A';
  if (postcode.startsWith('19')) return 'B';
  return 'C';
}

export function billableUnits(weightKg) {
  if (typeof weightKg !== 'number' || Number.isNaN(weightKg)) {
    throw new TariffError('WEIGHT_TYPE', 'Вес должен быть числом');
  }
  if (weightKg < MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG) {
    throw new TariffError('WEIGHT_RANGE', `Вес ${weightKg} кг вне диапазона ${MIN_WEIGHT_KG}-${MAX_WEIGHT_KG} кг`);
  }
  // единица тарификации - 0,5 кг
  return Math.ceil(weightKg * 2);
}

function unitRateKopecks(zone) {
  if (!Object.hasOwn(RATE_PER_UNIT_KOPECKS, zone)) {
    throw new TariffError('ZONE', `Нет ставки для зоны ${zone}`);
  }
  return RATE_PER_UNIT_KOPECKS[zone];
}

export function quote({ weightKg, postcode, express = false, fragile = false, loyalty = false }) {
  const zone = zoneForPostcode(postcode);
  const units = billableUnits(weightKg);
  let amount = units * unitRateKopecks(zone);
  if (express) amount = (amount * 3) / 2;
  if (fragile) amount += express ? FRAGILE_KOPECKS * 2 : FRAGILE_KOPECKS;
  if (loyalty && !express) amount = (amount * 9) / 10;
  return { zone, billableKg: units / 2, totalKopecks: Math.ceil(amount / 100) * 100 };
}

export function deliveryDays(zone, { express = false } = {}) {
  const table = express ? EXPRESS_DAYS : STANDARD_DAYS;
  if (!Object.hasOwn(table, zone)) throw new TariffError('ZONE', `Неизвестная зона: ${zone}`);
  return table[zone];
}
