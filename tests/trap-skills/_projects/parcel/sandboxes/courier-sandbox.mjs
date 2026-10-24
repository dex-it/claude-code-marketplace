#!/usr/bin/env node
// Песочница Курьер-Сервиса для локальной разработки и тестов.
//   node tools/courier-sandbox.mjs [--port 4020]
// Порт: --port, COURIER_SANDBOX_PORT или 4020; 0 - любой свободный. Ключ - любой вида cs_*.
// Недоступность: COURIER_SANDBOX_MODE=unavailable или POST /__sandbox/mode {"mode":"unavailable"|"normal"}.
import http from 'node:http';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const moscowDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' });

function datePlusDays(days) {
  const date = new Date(`${moscowDay.format(new Date())}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function reply(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export async function startCourierSandbox({ port = 4020, host = '127.0.0.1', mode = process.env.COURIER_SANDBOX_MODE } = {}) {
  let current = mode === 'unavailable' ? 'unavailable' : 'normal';
  const shipments = [];
  const server = http.createServer(async (req, res) => {
    const raw = await readBody(req);
    if (req.method === 'POST' && req.url === '/__sandbox/mode') {
      try {
        const { mode: next } = JSON.parse(raw);
        if (next !== 'normal' && next !== 'unavailable') return reply(res, 400, { error: 'mode: normal | unavailable' });
        current = next;
        return reply(res, 200, { mode: current });
      } catch {
        return reply(res, 400, { error: 'INVALID_JSON' });
      }
    }
    if (current === 'unavailable') return reply(res, 503, { error: 'SERVICE_UNAVAILABLE' });
    if (req.method !== 'POST' || req.url !== '/api/orders') return reply(res, 404, { error: 'NOT_FOUND' });
    if (!/^cs_\w+$/.test(req.headers['x-api-key'] ?? '')) return reply(res, 401, { error: 'UNAUTHORIZED' });
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply(res, 400, { error: 'INVALID_JSON' });
    }
    if (body.ref === undefined || body.ref === '') return reply(res, 400, { error: 'INVALID_REF', message: 'ref: required' });
    const { weight, to } = body;
    if (typeof weight !== 'number' || !(weight > 0) || weight > 30) {
      return reply(res, 400, { error: 'INVALID_WEIGHT', message: 'weight: kilograms, 0 < weight <= 30' });
    }
    if (!to || !/^\d{6}$/.test(String(to.zip)) || !to.address || !to.name || !to.phone) {
      return reply(res, 400, { error: 'INVALID_ADDRESS', message: 'to: zip (6 digits), address, name, phone required' });
    }
    const shipment = {
      trackNo: `CS-${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`,
      deliveryDate: datePlusDays(3),
    };
    shipments.push({ ref: body.ref, ...shipment });
    return reply(res, 200, shipment);
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
  return Number(process.env.COURIER_SANDBOX_PORT ?? 4020);
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const sandbox = await startCourierSandbox({ port: cliPort() });
  console.log(`Курьер-Сервис (песочница): ${sandbox.url}  ключ: любой вида cs_*, например cs_dev`);
}
