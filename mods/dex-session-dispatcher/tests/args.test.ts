import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { firstWord, newArgs, parseArgs } from '../hooks/args.ts'

describe('parseArgs', () => {
  it('слова без аргумента', () => {
    assert.deepEqual(parseArgs(''), { kind: 'toggle' })
    assert.deepEqual(parseArgs('list'), { kind: 'list' })
    assert.deepEqual(parseArgs('next'), { kind: 'step', delta: 1 })
    assert.deepEqual(parseArgs('prev'), { kind: 'step', delta: -1 })
    assert.deepEqual(parseArgs('finished'), { kind: 'finished' })
    assert.deepEqual(parseArgs('?'), { kind: 'help' })
  })

  it('номер или имя без слова - показать сессию', () => {
    assert.deepEqual(parseArgs('2'), { kind: 'show', query: '2' })
    assert.deepEqual(parseArgs('dp-3168'), { kind: 'show', query: 'dp-3168' })
  })

  it('new: задача, имя и каталог', () => {
    assert.deepEqual(parseArgs('new разобрать тесты'), { kind: 'new', task: 'разобрать тесты', name: '', dir: '' })
    assert.deepEqual(parseArgs('new --name тесты --dir /tmp/x разобрать их'), {
      kind: 'new',
      task: 'разобрать их',
      name: 'тесты',
      dir: '/tmp/x',
    })
    assert.deepEqual(parseArgs('start задача'), { kind: 'new', task: 'задача', name: '', dir: '' })
  })

  it('say: первая часть - адресат, остальное - текст', () => {
    assert.deepEqual(parseArgs('say 2 сделай ещё одно'), { kind: 'say', query: '2', text: 'сделай ещё одно' })
    assert.deepEqual(parseArgs('say "моя сессия" привет'), { kind: 'say', query: 'моя сессия', text: 'привет' })
  })

  it('log, open, stop, remove и их синонимы', () => {
    assert.deepEqual(parseArgs('log 3'), { kind: 'log', query: '3' })
    assert.deepEqual(parseArgs('logs fix'), { kind: 'log', query: 'fix' })
    assert.deepEqual(parseArgs('attach 1'), { kind: 'open', query: '1' })
    assert.deepEqual(parseArgs('kill 1'), { kind: 'stop', query: '1' })
    assert.deepEqual(parseArgs('rm 1'), { kind: 'remove', query: '1' })
  })
})

describe('firstWord и newArgs', () => {
  it('кавычки собирают слово с пробелами', () => {
    assert.deepEqual(firstWord('«мой друг» дальше'), { word: 'мой друг', rest: 'дальше' })
    assert.deepEqual(firstWord('один два три'), { word: 'один', rest: 'два три' })
    assert.deepEqual(firstWord(''), { word: '', rest: '' })
  })

  it('ключ после задачи задачей и остаётся', () => {
    assert.deepEqual(newArgs('сделай --name x'), { task: 'сделай --name x', name: '', dir: '' })
    assert.deepEqual(newArgs('--name=x сделай'), { task: 'сделай', name: 'x', dir: '' })
  })
})
