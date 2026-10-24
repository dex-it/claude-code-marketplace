import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load } from '../src/config/load.js'
import { defaultsLine } from '../src/report.js'

test('умолчания без переопределений', () => {
  assert.equal(load().retries, 3)
})

test('переопределение побеждает умолчание', () => {
  assert.equal(load({ retries: 1 }).retries, 1)
})

test('строка умолчаний', () => {
  assert.equal(defaultsLine(), 'defaults: base')
})
