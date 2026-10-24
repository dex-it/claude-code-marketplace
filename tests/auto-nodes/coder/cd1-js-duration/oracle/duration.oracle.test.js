import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { parseDuration } from '../src/duration.js'
import { scheduleIn } from '../src/scheduler.js'

const bad = (s) => (e) => e instanceof RangeError && e.message.includes(s)
test('R1 s', () => assert.equal(parseDuration('2s'), 2000))
test('R1 m', () => assert.equal(parseDuration('1m'), 60000))
test('R1 h', () => assert.equal(parseDuration('1h'), 3600000))
test('R2 ms', () => assert.equal(parseDuration('250ms'), 250))
test('R3 empty', () => assert.throws(() => parseDuration(''), (e) => e instanceof RangeError))
test('R3 no unit', () => assert.throws(() => parseDuration('500'), bad('500')))
test('R3 unknown unit', () => assert.throws(() => parseDuration('5x'), bad('5x')))
test('R3 negative', () => assert.throws(() => parseDuration('-1s'), bad('-1s')))
test('R3 fraction', () => assert.throws(() => parseDuration('1.5s'), bad('1.5s')))
test('regression scheduler delay', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    let hit = 0
    scheduleIn('2s', () => { hit++ })
    mock.timers.tick(1999); assert.equal(hit, 0)
    mock.timers.tick(1); assert.equal(hit, 1)
  } finally { mock.timers.reset() }
})
