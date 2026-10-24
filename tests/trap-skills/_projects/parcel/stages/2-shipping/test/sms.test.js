import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSmsSender, shipmentSms } from '../src/notify/sms.js';

const order = { id: 1042, trackingNumber: 'CS-104273', customer: { name: 'Мария Белова', phone: '+79213456703' } };

test('текст SMS об отправке', () => {
  assert.equal(shipmentSms(order), 'Ваш заказ 1042 отправлен. Трек: CS-104273');
});

test('SMS уходит на телефон клиента через шлюз', async () => {
  const sent = [];
  const gateway = { send: async (phone, text) => sent.push({ phone, text }) };
  await createSmsSender({ gateway }).send(order, 'shipment');
  assert.deepEqual(sent, [{ phone: '+79213456703', text: 'Ваш заказ 1042 отправлен. Трек: CS-104273' }]);
});
