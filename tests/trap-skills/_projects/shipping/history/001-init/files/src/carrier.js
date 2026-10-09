// Регистрация отправления у перевозчика - номер отслеживания. Клиент перевозчика - ctx.carrier
// (в проде - HTTP-клиент платформы; в тестах и на стенде - stubCarrier), таймаут -
// config.CARRIER_TIMEOUT_MS.
import { HttpError } from './errors.js';

export class CarrierTimeout extends HttpError {
  constructor(ms) {
    super(504, `перевозчик не ответил за ${ms} мс`);
  }
}

export const stubCarrier = {
  async register(shipment) {
    return { tracking: `DE${shipment.id.replace(/\D/g, '').padStart(10, '0')}` };
  },
};

export async function registerAtCarrier(shipment, ctx) {
  const ms = Number(ctx.config.CARRIER_TIMEOUT_MS ?? 2000);
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new CarrierTimeout(ms)), ms);
  });
  try {
    return await Promise.race([(ctx.carrier ?? stubCarrier).register(shipment), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
