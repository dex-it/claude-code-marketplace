// Какие инструменты каталога подхвачены и что мод делает, когда их нет.
//
//   node --test mods/dex-jira-tracker/tests

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { detectTools, installLine, installTargets, toolOf, toolsText } from '../hooks/tools.ts'

describe('detectTools', () => {
  test('ничего не установлено - все роли названы и у каждой есть чем заменить', () => {
    const found = detectTools([])

    assert.equal(found.length, 6)
    assert.equal(found.every(item => !item.installed && item.fallback !== ''), true)
  })

  test('команда находится и по голому имени, и с префиксом плагина, и со слэшем', () => {
    const found = detectTools([{ name: 'dex-implement:implement' }, { name: '/feature' }])

    assert.equal(toolOf(found, 'implement').installed, true)
    assert.equal(toolOf(found, 'implement').actual, 'implement')
    assert.equal(toolOf(found, 'spec').installed, true)
  })

  test('чужая /pr не считается трекером GitHub; /pr трекера - считается', () => {
    const other = detectTools([{ name: 'pr', plugin: 'some-other-plugin' }])
    const mine = detectTools([{ name: 'pr', plugin: 'dex-github-pr-tracker' }])
    const unknown = detectTools([{ name: 'pr' }])

    assert.equal(toolOf(other, 'github').installed, false)
    assert.equal(toolOf(mine, 'github').installed, true)
    assert.equal(toolOf(unknown, 'github').installed, true)
  })

  test('настройка называет другую команду реализации - ищется она', () => {
    const found = detectTools([{ name: 'build-it' }], { implement: 'build-it' })

    assert.equal(toolOf(found, 'implement').installed, true)
    assert.equal(toolOf(found, 'implement').actual, 'build-it')
    assert.equal(toolOf(detectTools([{ name: 'implement' }], { implement: 'build-it' }), 'implement').installed, false)
  })
})

describe('установка и вывод', () => {
  const found = detectTools([{ name: 'implement' }])

  test('строка установки', () => {
    assert.equal(installLine('dex-implement'), 'claude plugin install dex-implement@dex-claude-marketplace')
  })

  test('цели установки: all - недостающие, роль - она, установленная - ничего, незнакомая - null', () => {
    assert.equal(installTargets(found, 'all')?.length, 5)
    assert.deepEqual(installTargets(found, 'spec')?.map(item => item.plugin), ['dex-business-analyst'])
    assert.deepEqual(installTargets(found, 'implement'), [])
    assert.equal(installTargets(found, 'nonsense'), null)
  })

  test('текст: установленное с плагином, недостающее со строкой установки, клиенты хостингов', () => {
    const text = toolsText(found, { gh: true, glab: false })

    assert.match(text, /- реализация по постановке: \/implement \(dex-implement\)/)
    assert.match(text, /- постановка задачи: не установлено - .*claude plugin install dex-business-analyst@dex-claude-marketplace/)
    assert.match(text, /gh - есть, glab - нет/)
    assert.match(text, /\/jira tools install/)
  })

  test('всё есть - так и сказано', () => {
    const all = detectTools(
      ['feature', 'implement', 'self-review', 'mr-review'].map(name => ({ name })).concat([
        { name: 'pr' },
        { name: 'mr' },
      ]),
    )

    assert.match(toolsText(all, { gh: true, glab: true }), /Всё установлено/)
  })
})
