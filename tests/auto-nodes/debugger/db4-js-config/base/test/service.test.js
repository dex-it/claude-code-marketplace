import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createService } from '../src/service.js'
import { describe } from '../src/report.js'

test('сервис получает переопределение', () => {
  assert.equal(createService('billing', { retries: 5 }).cfg.retries, 5)
})

test('тег сервиса в строке отчёта', () => {
  const billing = createService('billing')
  billing.addTag('eu')
  assert.equal(describe(billing), 'billing: base, eu')
})
