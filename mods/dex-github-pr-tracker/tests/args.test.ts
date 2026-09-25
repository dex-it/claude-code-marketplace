// The grammar of `/pr`: every word it answers to, and what an argument that
// is none of them does.

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { parseArgs } from '../hooks/args.ts'

describe('parseArgs', () => {
  test('no argument toggles the pane', () => {
    assert.deepEqual(parseArgs(''), { kind: 'toggle' })
    assert.deepEqual(parseArgs('   '), { kind: 'toggle' })
  })

  test('the words answer regardless of case', () => {
    assert.deepEqual(parseArgs('threads'), { kind: 'threads' })
    assert.deepEqual(parseArgs('STATUS'), { kind: 'status' })
    assert.deepEqual(parseArgs('Refresh'), { kind: 'refresh' })
  })

  test('checks answers to its own name and to ci', () => {
    assert.deepEqual(parseArgs('checks'), { kind: 'checks' })
    assert.deepEqual(parseArgs('CI'), { kind: 'checks' })
  })

  test('drop takes one PR, all of them, or the shown one', () => {
    assert.deepEqual(parseArgs('drop'), { kind: 'drop', target: 'selected' })
    assert.deepEqual(parseArgs('drop all'), { kind: 'drop', target: 'all' })
    assert.deepEqual(parseArgs('stop 42'), { kind: 'drop', target: 42 })
  })

  test('a number is the PR of this repository, with or without the hash', () => {
    assert.deepEqual(parseArgs('123'), { kind: 'watch', number: 123, text: '123' })
    assert.deepEqual(parseArgs('#123'), { kind: 'watch', number: 123, text: '#123' })
  })

  test('a URL is watched as it is, and the caller reads the repository off it', () => {
    const url = 'https://github.com/dex-it/marketplace/pull/9'

    assert.deepEqual(parseArgs(url), { kind: 'watch', number: null, text: url })
  })

  test('anything else asks for the help text instead of guessing', () => {
    assert.deepEqual(parseArgs('что-то ещё'), { kind: 'help' })
    assert.deepEqual(parseArgs('https://github.com/dex-it/marketplace/issues/9'), {
      kind: 'help',
    })
  })
})
