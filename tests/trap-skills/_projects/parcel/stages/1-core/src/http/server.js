import http from 'node:http';
import { cancelOrder, getOrder } from './orders-api.js';

function send(res, status, body) {
  if (body === undefined) {
    res.writeHead(status);
    res.end();
    return;
  }
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export function createServer({ store, payments, stock }) {
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
      send(res, 404, { type: 'route-not-found' });
    } catch (error) {
      console.error(error);
      send(res, 500, { type: 'internal' });
    }
  });
}
