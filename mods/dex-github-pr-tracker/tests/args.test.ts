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

  test('the overview list answers to its own name and to the short one', () => {
    assert.deepEqual(parseArgs('list'), { kind: 'list' })
    assert.deepEqual(parseArgs('LS'), { kind: 'list' })
  })

  test('repo without an argument asks what is chosen', () => {
    assert.deepEqual(parseArgs('repo'), { kind: 'repo', text: '' })
    assert.deepEqual(parseArgs('repository'), { kind: 'repo', text: '' })
  })

  test('repo keeps the case of its argument: owner and repo are case-sensitive', () => {
    assert.deepEqual(parseArgs('repo dex-IT/Marketplace'), {
      kind: 'repo',
      text: 'dex-IT/Marketplace',
    })
    assert.deepEqual(parseArgs('repository  gh.corp/Team/App  '), {
      kind: 'repo',
      text: 'gh.corp/Team/App',
    })
  })

  test('anything else asks for the help text instead of guessing', () => {
    assert.deepEqual(parseArgs('что-то ещё'), { kind: 'help' })
    assert.deepEqual(parseArgs('https://github.com/dex-it/marketplace/issues/9'), {
      kind: 'help',
    })
  })
})

describe('parseArgs: охват, ревью, фиксер', () => {
  test('open, week and branch pick the scope', () => {
    assert.deepEqual(parseArgs('open'), { kind: 'scope', scope: 'open' })
    assert.deepEqual(parseArgs('WEEK'), { kind: 'scope', scope: 'week' })
    assert.deepEqual(parseArgs('branch'), { kind: 'scope', scope: 'branch' })
  })

  test('review takes the shown PR or a number', () => {
    assert.deepEqual(parseArgs('review'), { kind: 'review', number: null })
    assert.deepEqual(parseArgs('review 12'), { kind: 'review', number: 12 })
    assert.deepEqual(parseArgs('review #12'), { kind: 'review', number: 12 })
  })

  test('fix takes all the open threads or one by its number', () => {
    assert.deepEqual(parseArgs('fix'), { kind: 'fix', target: 'all' })
    assert.deepEqual(parseArgs('fix all'), { kind: 'fix', target: 'all' })
    assert.deepEqual(parseArgs('fix 3'), { kind: 'fix', target: 3 })
  })

  test('a fix with a word that is none of the targets is help, not a guess', () => {
    assert.deepEqual(parseArgs('fix everything'), { kind: 'help' })
  })
})

describe('parseArgs: навигация', () => {
  test('next and prev step through the list', () => {
    assert.deepEqual(parseArgs('next'), { kind: 'step', delta: 1 })
    assert.deepEqual(parseArgs('PREV'), { kind: 'step', delta: -1 })
  })
})
