import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDuration } from '../src/duration.js'

test('seconds', () => assert.equal(parseDuration('2s'), 2))
test('minutes', () => assert.equal(parseDuration('1m'), 60))
