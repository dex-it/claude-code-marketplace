// Проверка ключа db4, не часть базы: красная на base, на ref/ зелёная обе; на decoy/ (ложная правка в service.js) зелёная первая, красная вторая.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createService } from '../src/service.js'
import { createPlugin } from '../src/plugins.js'
import { describe, defaultsLine } from '../src/report.js'

test('тег billing не виден сервису search', () => {
  createService('billing').addTag('eu')
  assert.equal(describe(createService('search')), 'search: base')
})

test('тег плагина не виден умолчаниям', () => {
  createPlugin('audit').enable('strict')
  assert.equal(defaultsLine(), 'defaults: base')
})
