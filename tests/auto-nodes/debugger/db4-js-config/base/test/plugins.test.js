import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPlugin } from '../src/plugins.js'
import { describe } from '../src/report.js'

test('тег плагина в строке отчёта', () => {
  const audit = createPlugin('audit')
  audit.enable('strict')
  assert.equal(describe(audit), 'audit: base, strict')
})
