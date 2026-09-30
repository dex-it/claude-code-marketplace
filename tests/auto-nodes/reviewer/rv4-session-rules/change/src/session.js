import { now } from './clock.js'

export function createSession({ ttlMs }) {
  if (!(ttlMs > 0)) throw new Error(`ttlMs must be > 0, got ${ttlMs}`)
  return { createdAt: now(), ttlMs }
}

export function isExpired(session) {
  return Date.now() >= session.createdAt + session.ttlMs
}
