import { now } from './clock.js'

export function createSession({ ttlMs }) {
  return { createdAt: now(), ttlMs }
}
