// Причина отказа glab: вывод начинается строкой ERROR, суть идёт ниже.

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { reasonLine } from '../hooks/backend.ts'

describe('reasonLine', () => {
  test('the bare ERROR line is skipped and the cause is shown', () => {
    assert.equal(reasonLine('ERROR\n\nGET https://gl/api/v4/x: 500 {message: boom}'), 'GET https://gl/api/v4/x: 500 {message: boom}')
  })

  test('a message with no ERROR header stays as it is', () => {
    assert.equal(reasonLine('read tcp: i/o timeout'), 'read tcp: i/o timeout')
  })

  test('only ERROR is better than nothing', () => {
    assert.equal(reasonLine('ERROR'), 'ERROR')
  })
})
