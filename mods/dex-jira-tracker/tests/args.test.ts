// Грамматика `/jira`: слова разобраны тестом, а не пробой в сессии.
//
//   node --test mods/dex-jira-tracker/tests

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { keyOfText, parseArgs } from '../hooks/args.ts'

describe('parseArgs', () => {
  test('слова без аргумента', () => {
    assert.deepEqual(parseArgs(''), { kind: 'toggle' })
    assert.deepEqual(parseArgs('  LIST '), { kind: 'list' })
    assert.deepEqual(parseArgs('refresh'), { kind: 'refresh' })
    assert.deepEqual(parseArgs('pr'), { kind: 'hosting' })
    assert.deepEqual(parseArgs('mr'), { kind: 'hosting' })
  })

  test('отборы списка: new и fresh - одно', () => {
    assert.deepEqual(parseArgs('mine'), { kind: 'filter', filter: 'mine' })
    assert.deepEqual(parseArgs('progress'), { kind: 'filter', filter: 'progress' })
    assert.deepEqual(parseArgs('new'), { kind: 'filter', filter: 'fresh' })
    assert.deepEqual(parseArgs('fresh'), { kind: 'filter', filter: 'fresh' })
    assert.deepEqual(parseArgs('done'), { kind: 'filter', filter: 'done' })
  })

  test('ключ, ссылка и голый номер ведут к деталям', () => {
    assert.deepEqual(parseArgs('sup-12'), { kind: 'show', key: 'SUP-12', number: null })
    assert.deepEqual(parseArgs('https://jira.example.com/browse/SUP-12?x=1'), { kind: 'show', key: 'SUP-12', number: null })
    assert.deepEqual(parseArgs('#12'), { kind: 'show', key: null, number: 12 })
    assert.deepEqual(parseArgs('12'), { kind: 'show', key: null, number: 12 })
  })

  test('действия над задачей: с ключом и без', () => {
    assert.deepEqual(parseArgs('work'), { kind: 'work', key: null })
    assert.deepEqual(parseArgs('work sup-3'), { kind: 'work', key: 'SUP-3' })
    assert.deepEqual(parseArgs('ship SUP-3'), { kind: 'ship', key: 'SUP-3' })
    assert.deepEqual(parseArgs('publish'), { kind: 'publish', key: null })
    assert.deepEqual(parseArgs('comments SUP-3'), { kind: 'comments', key: 'SUP-3' })
  })

  test('действие с мусором вместо ключа - подсказка, а не молчаливая работа над выбранной', () => {
    assert.deepEqual(parseArgs('work сделай всё'), { kind: 'help' })
    assert.deepEqual(parseArgs('ship ???'), { kind: 'help' })
  })

  test('spec: идея целиком, ключ как ключ', () => {
    assert.deepEqual(parseArgs('spec'), { kind: 'spec', text: '' })
    assert.deepEqual(parseArgs('spec Выгрузка отчёта в CSV'), { kind: 'spec', text: 'Выгрузка отчёта в CSV' })
    assert.deepEqual(parseArgs('spec SUP-4'), { kind: 'spec', text: 'SUP-4' })
  })

  test('seen: выбранная, все, по ключу', () => {
    assert.deepEqual(parseArgs('seen'), { kind: 'seen', target: 'selected' })
    assert.deepEqual(parseArgs('seen all'), { kind: 'seen', target: 'all' })
    assert.deepEqual(parseArgs('seen sup-9'), { kind: 'seen', target: 'SUP-9' })
  })

  test('проект, охват, JQL: регистр аргумента сохраняется', () => {
    assert.deepEqual(parseArgs('project Sup'), { kind: 'project', text: 'Sup' })
    assert.deepEqual(parseArgs('scope mine'), { kind: 'scope', scope: 'mine' })
    assert.deepEqual(parseArgs('scope weekly'), { kind: 'help' })
    assert.deepEqual(parseArgs('jql labels = "Urgent"'), { kind: 'jql', text: 'labels = "Urgent"' })
  })

  test('tools: показать и поставить', () => {
    assert.deepEqual(parseArgs('tools'), { kind: 'tools', install: null })
    assert.deepEqual(parseArgs('tools install'), { kind: 'tools', install: 'all' })
    assert.deepEqual(parseArgs('tools install implement'), { kind: 'tools', install: 'implement' })
  })

  test('слово из прототипа объекта не становится командой', () => {
    assert.deepEqual(parseArgs('constructor'), { kind: 'help' })
    assert.deepEqual(parseArgs('toString'), { kind: 'help' })
  })

  test('непонятное - подсказка', () => {
    assert.deepEqual(parseArgs('что-то'), { kind: 'help' })
  })
})

describe('keyOfText', () => {
  test('ключ из ключа и ссылки; из прозы - нет', () => {
    assert.equal(keyOfText('abc-7'), 'ABC-7')
    assert.equal(keyOfText('https://x/jira/browse/Abc_1-7'), 'ABC_1-7')
    assert.equal(keyOfText('смотри abc-7'), null)
  })
})
