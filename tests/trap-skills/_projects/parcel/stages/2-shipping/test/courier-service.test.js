import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCourierServiceClient } from '../src/carrier/courier-service.js';
import { CarrierError } from '../src/carrier/errors.js';

const order = {
  id: 1042,
  weightKg: 1.2,
  customer: { name: 'Мария Белова', phone: '+79213456703' },
  address: { postcode: '190121', line: 'Санкт-Петербург, наб. Крюкова канала, 4, кв. 9' },
};

function fakeFetch(status, body) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  };
  return { impl, calls };
}

test('создание отправки: запрос по контракту Курьер-Сервиса', async () => {
  const { impl, calls } = fakeFetch(200, { trackNo: 'CS-104273', deliveryDate: '2026-10-02' });
  const client = createCourierServiceClient({ baseUrl: 'http://cs.test', apiKey: 'cs_dev', fetchImpl: impl });
  const result = await client.createShipment(order);
  assert.deepEqual(result, { trackingNumber: 'CS-104273', eta: '2026-10-02' });
  assert.equal(calls[0].url, 'http://cs.test/api/orders');
  assert.equal(calls[0].init.headers['x-api-key'], 'cs_dev');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    ref: '1042',
    weight: 1.2,
    to: { zip: '190121', address: order.address.line, name: 'Мария Белова', phone: '+79213456703' },
  });
});

test('503 от Курьер-Сервиса - CarrierError с признаком повтора', async () => {
  const { impl } = fakeFetch(503, { error: 'SERVICE_UNAVAILABLE' });
  const client = createCourierServiceClient({ baseUrl: 'http://cs.test', apiKey: 'cs_dev', fetchImpl: impl });
  await assert.rejects(client.createShipment(order), (error) => {
    assert.ok(error instanceof CarrierError);
    assert.equal(error.status, 503);
    assert.equal(error.retryable, true);
    return true;
  });
});
