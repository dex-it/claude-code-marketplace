// Роутер сервиса: handle(req, ctx) -> {status, body}. HTTP-сервер и очередь даёт платформа, здесь -
// только логика, поэтому тесты и стенд вызывают handle напрямую.
//   req = {method, path, body, headers}
//   ctx = {config, flags, now, log, store, queue, carrier} - всё необязательно, см. defaults
import { HttpError } from './errors.js';
import { parseParcel } from './request.js';
import { quote } from './quote.js';
import { createShipment, getShipment } from './shipments.js';

const silent = { info() {}, warn() {}, error() {} };
const defaults = { config: {}, flags: {}, log: silent, store: new Map(), queue: { publish() {} } };

function postQuote(req) {
  return { status: 200, body: quote(parseParcel(req.body)) };
}

async function postShipment(req, ctx) {
  return { status: 201, body: await createShipment(req.body, ctx) };
}

const routes = [
  ['POST', /^\/quote$/, postQuote],
  ['POST', /^\/shipments$/, postShipment],
  ['GET', /^\/shipments\/(\w+)$/, (req, ctx, m) => ({ status: 200, body: getShipment(m[1], ctx) })],
  ['GET', /^\/health$/, () => ({ status: 200, body: { status: 'ok' } })],
];

export async function handle(req, ctx = {}) {
  const c = { ...defaults, now: new Date().toISOString(), ...ctx, requestId: req.headers?.['x-request-id'] };
  try {
    for (const [method, re, fn] of routes) {
      const m = re.exec(req.path);
      if (m && req.method === method) return await fn(req, c, m);
    }
    return { status: 404, body: { error: `нет маршрута ${req.method} ${req.path}` } };
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, body: { error: e.message } };
    c.log.error('unhandled', { error: e.message });
    return { status: 500, body: { error: e.message, stack: e.stack } };
  }
}
