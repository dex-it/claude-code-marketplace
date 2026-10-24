import http from 'node:http'
import { handleHealth } from './health.js'

export function createServer(routes) {
  return http.createServer(async (req, res) => {
    const handler = routes[`${req.method} ${req.url}`]
    if (!handler) {
      res.statusCode = 404
      return res.end()
    }
    try {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const out = await handler({ body: Buffer.concat(chunks).toString('utf8'), headers: req.headers })
      res.statusCode = out.status
      res.end(out.body ?? '')
    } catch {
      res.statusCode = 500
      res.end()
    }
  })
}

export function start() {
  const port = Number(process.env.PORT ?? 3000)
  return createServer({ 'GET /health': handleHealth }).listen(port)
}
