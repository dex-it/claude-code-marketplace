#!/usr/bin/env node
// Песочница SwiftPost для локальной разработки и тестов.
//   node tools/swiftpost-sandbox.mjs [--port 4010]
// Порт: --port, SWIFTPOST_SANDBOX_PORT или 4010; 0 - любой свободный. Токен - любой вида sbx_*.
// Недоступность: SWIFTPOST_SANDBOX_MODE=unavailable или POST /__sandbox/mode {"mode":"unavailable"|"normal"}.
import http from 'node:http';
import { randomBytes, randomInt } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const moscowDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' });

function moscowDatePlusDays(days) {
  const date = new Date(`${moscowDay.format(new Date())}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function reply(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

function validate(body) {
  if (body.reference === undefined || body.reference === null || body.reference === '') return 'reference: required';
  if (!Number.isInteger(body.weight_grams) || body.weight_grams <= 0) return 'weight_grams: integer required';
  if (body.service !== undefined && body.service !== 'standard' && body.service !== 'express') return 'service: standard | express';
  const r = body.recipient;
  if (!r || !r.name || !r.phone || !r.address || !/^\d{6}$/.test(String(r.address.postcode)) || !r.address.line) {
    return 'recipient: name, phone, address.postcode (6 digits), address.line required';
  }
  return null;
}

export async function startSwiftPostSandbox({ port = 4010, host = '127.0.0.1', mode = process.env.SWIFTPOST_SANDBOX_MODE } = {}) {
  let current = mode === 'unavailable' ? 'unavailable' : 'normal';
  const shipments = [];
  const server = http.createServer(async (req, res) => {
    const raw = await readBody(req);
    if (req.method === 'POST' && req.url === '/__sandbox/mode') {
      try {
        const { mode: next } = JSON.parse(raw);
        if (next !== 'normal' && next !== 'unavailable') return reply(res, 400, { code: 'VALIDATION', message: 'mode: normal | unavailable' });
        current = next;
        return reply(res, 200, { mode: current });
      } catch {
        return reply(res, 400, { code: 'VALIDATION', message: 'invalid JSON' });
      }
    }
    if (current === 'unavailable') return reply(res, 503, { code: 'UNAVAILABLE', message: 'Service temporarily unavailable' }, { 'retry-after': '30' });
    if (req.method !== 'POST' || req.url !== '/v2/shipments') return reply(res, 404, { code: 'NOT_FOUND', message: `${req.method} ${req.url}` });
    if (!/^Bearer sbx_\w+$/.test(req.headers.authorization ?? '')) return reply(res, 401, { code: 'UNAUTHORIZED', message: 'invalid token' });
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply(res, 400, { code: 'VALIDATION', message: 'invalid JSON' });
    }
    const problem = validate(body);
    if (problem) return reply(res, 400, { code: 'VALIDATION', message: problem });
    if (body.recipient.address.postcode === '000000') {
      return reply(res, 422, { code: 'ADDRESS_UNDELIVERABLE', message: 'Address is outside the delivery area' });
    }
    const id = `shp_${randomBytes(6).toString('hex')}`;
    const shipment = {
      id,
      tracking_number: `SP${String(randomInt(0, 1e10)).padStart(10, '0')}`,
      estimated_delivery: `${moscowDatePlusDays(2)}T18:00:00+03:00`,
      label_url: `http://${host}:${server.address().port}/v2/labels/${id}.pdf`,
    };
    shipments.push({ reference: body.reference, weight_grams: body.weight_grams, ...shipment });
    return reply(res, 201, shipment);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const actual = server.address().port;
  return {
    url: `http://${host}:${actual}`,
    port: actual,
    shipments,
    setMode(next) {
      current = next;
    },
    close() {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

function cliPort() {
  const i = process.argv.indexOf('--port');
  if (i >= 0) return Number(process.argv[i + 1]);
  return Number(process.env.SWIFTPOST_SANDBOX_PORT ?? 4010);
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const sandbox = await startSwiftPostSandbox({ port: cliPort() });
  console.log(`SwiftPost (песочница): ${sandbox.url}  токен: любой вида sbx_*, например sbx_parcel_dev`);
}
