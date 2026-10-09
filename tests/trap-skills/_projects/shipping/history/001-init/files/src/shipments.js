// Оформление отправления: разбор, цена, регистрация у перевозчика, хранение, сообщение в очередь
// labels для label-worker (контракт - docs/messages.md).
import { HttpError } from './errors.js';
import { parseParcel } from './request.js';
import { quote } from './quote.js';
import { registerAtCarrier } from './carrier.js';

export async function createShipment(body, ctx) {
  const parcel = parseParcel(body);
  const { price, billableKg } = quote(parcel);
  const id = `S${String(ctx.store.size + 1).padStart(6, '0')}`;
  const { tracking } = await registerAtCarrier({ id, ...parcel }, ctx);
  const shipment = {
    id,
    tracking,
    status: 'created',
    postcode: parcel.postcode,
    zone: parcel.zone,
    weightGrams: parcel.weightGrams,
    billableKg,
    express: parcel.express,
    price,
    currency: parcel.currency,
    createdAt: ctx.now,
  };
  ctx.store.set(id, shipment);
  ctx.queue.publish('labels', {
    id,
    tracking,
    postcode: parcel.postcode,
    zone: parcel.zone,
    weightGrams: parcel.weightGrams,
    express: parcel.express,
  });
  ctx.log.info('shipment created', { id, postcode: parcel.postcode, zone: parcel.zone, price });
  return shipment;
}

export function getShipment(id, ctx) {
  const shipment = ctx.store.get(id);
  if (!shipment) throw new HttpError(404, `отправление ${id} не найдено`);
  return shipment;
}
