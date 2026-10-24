import test from 'node:test'
import assert from 'node:assert/strict'
import { createSession } from '../src/session.js'
import { setNow } from '../src/clock.js'

test('createSession ставит createdAt по часам', () => {
  setNow(1000)
  assert.equal(createSession({ ttlMs: 50 }).createdAt, 1000)
  setNow(null)
})
