// The grammar of `/mr`: every word it answers to, and what an argument that
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

  test('list and its short form ask for the watch list, whatever the case', () => {
    assert.deepEqual(parseArgs('list'), { kind: 'list' })
    assert.deepEqual(parseArgs('LIST'), { kind: 'list' })
    assert.deepEqual(parseArgs('ls'), { kind: 'list' })
    assert.deepEqual(parseArgs('Ls'), { kind: 'list' })
  })

  test('repo with no argument asks which project is chosen', () => {
    assert.deepEqual(parseArgs('repo'), { kind: 'repo', text: '' })
    assert.deepEqual(parseArgs('project'), { kind: 'repo', text: '' })
  })

  test('the project argument keeps its case: a GitLab path is case-sensitive', () => {
    assert.deepEqual(parseArgs('repo group/Proj'), { kind: 'repo', text: 'group/Proj' })
    assert.deepEqual(parseArgs('project gl.corp/G/P'), {
      kind: 'repo',
      text: 'gl.corp/G/P',
    })
  })

  test('the spaces around the project argument are cut', () => {
    assert.deepEqual(parseArgs('  repo   group/Proj  '), {
      kind: 'repo',
      text: 'group/Proj',
    })
  })

  test('drop takes one MR, all of them, or the shown one', () => {
    assert.deepEqual(parseArgs('drop'), { kind: 'drop', target: 'selected' })
    assert.deepEqual(parseArgs('drop all'), { kind: 'drop', target: 'all' })
    assert.deepEqual(parseArgs('stop 42'), { kind: 'drop', target: 42 })
  })

  test('a number is the MR of this project, with or without the bang', () => {
    assert.deepEqual(parseArgs('123'), { kind: 'watch', iid: 123, text: '123' })
    assert.deepEqual(parseArgs('!123'), { kind: 'watch', iid: 123, text: '!123' })
  })

  test('a URL is watched as it is, and the caller reads the project off it', () => {
    const url = 'https://gl.corp/a/b/-/merge_requests/9'

    assert.deepEqual(parseArgs(url), { kind: 'watch', iid: null, text: url })
  })

  test('anything else asks for the help text instead of guessing', () => {
    assert.deepEqual(parseArgs('что-то ещё'), { kind: 'help' })
    assert.deepEqual(parseArgs('https://gl.corp/a/b/-/issues/9'), { kind: 'help' })
  })
})
