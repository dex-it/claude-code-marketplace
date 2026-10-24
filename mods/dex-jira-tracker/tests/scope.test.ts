// Какие задачи мод держит: JQL трёх запросов опроса. jira-cli сам кладёт
// запрос в контекст проекта и дописывает свой ORDER BY, поэтому проекта в
// запросах нет, а чужой ORDER BY - отказ.
//
//   node --test mods/dex-jira-tracker/tests

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { PROJECT_RE, projectOfKeys, queriesOf, scopeOf } from '../hooks/scope.ts'

describe('queriesOf', () => {
  test('весь проект: открытые и тронутые за окно; открытость - по категории статуса, не по resolution', () => {
    const out = queriesOf({ scope: 'project', jql: '', doneDays: 1 })

    assert.equal(out.queries?.base, '(statusCategory != Done OR updated >= -1d)')
    assert.equal(out.queries?.open, '(statusCategory != Done)')
    assert.equal(out.queries?.progress, '(statusCategory = "In Progress")')
    assert.equal(out.queries?.mine, '(statusCategory != Done) AND (assignee = currentUser())')
    assert.doesNotMatch(JSON.stringify(out.queries), /resolution/i)
  })

  test('мои задачи сужают все три запроса', () => {
    const out = queriesOf({ scope: 'mine', jql: '', doneDays: 2 })

    assert.match(out.queries?.base ?? '', /^\(assignee = currentUser\(\)\) AND/)
    assert.match(out.queries?.base ?? '', /updated >= -2d/)
    assert.match(out.queries?.progress ?? '', /^\(assignee = currentUser\(\)\) AND/)
  })

  test('спринт', () => {
    assert.match(queriesOf({ scope: 'sprint', jql: '', doneDays: 1 }).queries?.base ?? '', /sprint in openSprints\(\)/)
  })

  test('свой JQL берётся в скобки, чтобы его OR не съел остальное', () => {
    const out = queriesOf({ scope: 'jql', jql: 'labels = a OR labels = b', doneDays: 0 })

    assert.equal(out.queries?.base, '(labels = a OR labels = b) AND (statusCategory != Done)')
  })

  test('doneDays 0: закрытые не нужны', () => {
    assert.equal(queriesOf({ scope: 'project', jql: '', doneDays: 0 }).queries?.base, '(statusCategory != Done)')
  })

  test('пустой свой JQL и ORDER BY в нём - отказ с причиной', () => {
    assert.match(queriesOf({ scope: 'jql', jql: '  ', doneDays: 1 }).reason ?? '', /пуста/)
    assert.match(queriesOf({ scope: 'jql', jql: 'a = b order by created', doneDays: 1 }).reason ?? '', /ORDER BY/)
  })
})

describe('мелочи охвата', () => {
  test('scopeOf: неизвестное - запасное', () => {
    assert.equal(scopeOf('sprint', 'project'), 'sprint')
    assert.equal(scopeOf('weekly', 'project'), 'project')
  })

  test('ключ проекта: буквы, цифры, подчёркивание; без пробелов и кавычек', () => {
    assert.equal(PROJECT_RE.test('SUP'), true)
    assert.equal(PROJECT_RE.test('A_B2'), true)
    assert.equal(PROJECT_RE.test('SUP"; DROP'), false)
    assert.equal(PROJECT_RE.test('1SUP'), false)
  })

  test('projectOfKeys: чаще всего встречающийся префикс', () => {
    assert.equal(projectOfKeys(['SUP-1', 'SUP-2', 'ABC-9']), 'SUP')
    assert.equal(projectOfKeys([]), '')
  })
})
