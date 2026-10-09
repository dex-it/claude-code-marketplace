import http from 'node:http';
import { cancelOrder, getOrder } from './orders-api.js';
import { handlePaymentWebhook } from './webhooks.js';

function send(res, status, body) {
  if (body === undefined) {
    res.writeHead(status);
    res.end();
    return;
  }
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

export function createServer({ store, payments, stock, carrier }) {
  return http.createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, 'http://localhost');
      const customerId = req.headers['x-customer-id'];
      let match;
      if (req.method === 'GET' && (match = pathname.match(/^\/api\/orders\/([^/]+)$/))) {
        const result = getOrder({ store, id: match[1], customerId });
        return send(res, result.status, result.body);
      }
      if (req.method === 'POST' && (match = pathname.match(/^\/api\/orders\/([^/]+)\/cancel$/))) {
        const result = cancelOrder({ store, id: match[1], customerId, payments, stock });
        return send(res, result.status, result.body);
      }
      if (req.method === 'POST' && pathname === '/webhooks/payments') {
        const body = await readJson(req);
        const result = await handlePaymentWebhook(body, carrier ? { store, carrier } : { store });
        return send(res, 200, { status: result.status });
      }
      send(res, 404, { type: 'route-not-found' });
    } catch (error) {
      console.error(error);
      send(res, 500, { type: 'internal' });
    }
  });
}
