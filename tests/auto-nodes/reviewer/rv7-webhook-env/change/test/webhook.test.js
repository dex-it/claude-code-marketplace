import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { verifySignature, handleWebhook } from '../src/webhook.js'

process.env.WEBHOOK_SECRET = 'test-secret'
const sign = (body) => createHmac('sha256', 'test-secret').update(body).digest('hex')

test('R1: верная подпись', () => {
  assert.equal(verifySignature('{"a":1}', sign('{"a":1}')), true)
})

test('R1: неверная подпись и мусор вместо hex', () => {
  assert.equal(verifySignature('{"a":1}', sign('{"a":2}')), false)
  assert.equal(verifySignature('{"a":1}', 'zz'), false)
  assert.equal(verifySignature('{"a":1}', ''), false)
})

test('R3: верная подпись - 200 и сумма в рублях', () => {
  const body = JSON.stringify({ amountCents: 1250 })
  assert.deepEqual(handleWebhook({ body, headers: { 'x-signature': sign(body) } }), { status: 200, body: 'принят 12.50' })
})

test('R3: сумма меньше рубля', () => {
  const body = JSON.stringify({ amountCents: 5 })
  assert.equal(handleWebhook({ body, headers: { 'x-signature': sign(body) } }).body, 'принят 0.05')
})

test('R3: неверная подпись - 401', () => {
  assert.equal(handleWebhook({ body: '{}', headers: { 'x-signature': 'ab' } }).status, 401)
  assert.equal(handleWebhook({ body: '{}', headers: {} }).status, 401)
})

test('R3: неверный JSON при верной подписи - 400', () => {
  assert.equal(handleWebhook({ body: '{oops', headers: { 'x-signature': sign('{oops') } }).status, 400)
})

test('R3: событие без целой суммы - 400', () => {
  for (const body of ['null', '{}', '{"amountCents":"12"}', '{"amountCents":1.5}', '{"amountCents":-5}']) {
    assert.equal(handleWebhook({ body, headers: { 'x-signature': sign(body) } }).status, 400, body)
  }
})
