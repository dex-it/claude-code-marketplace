import test from 'node:test'
import assert from 'node:assert/strict'
import { createSession, isExpired } from '../src/session.js'
import { setNow } from '../src/clock.js'

test('createSession ставит createdAt по часам', () => {
  setNow(1000)
  assert.equal(createSession({ ttlMs: 50 }).createdAt, 1000)
  setNow(null)
})

test('R1: истёкшая сессия', () => {
  assert.equal(isExpired({ createdAt: Date.now() - 1000, ttlMs: 10 }), true)
})

test('R1: живая сессия', () => {
  assert.equal(isExpired({ createdAt: Date.now(), ttlMs: 60000 }), false)
})

test('R2: ttlMs <= 0 отклоняется', () => {
  assert.throws(() => createSession({ ttlMs: 0 }))
  assert.throws(() => createSession({ ttlMs: -5 }))
})
