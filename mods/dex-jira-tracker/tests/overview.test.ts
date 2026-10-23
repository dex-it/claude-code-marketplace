// Общий список: что ждёт человека идёт первым, отборы сужают строки, а итог
// считает по всему набору. И тексты, которые читает модель.
//
//   node --test mods/dex-jira-tracker/tests

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { Issue } from '../hooks/jira.ts'
import { fingerprint } from '../hooks/jira.ts'
import { filterOf, overviewOf } from '../hooks/overview.ts'
import { commentsText, issueText, overviewText, rowText, tallyText } from '../hooks/text.ts'
import { trackedOf } from '../hooks/watched.ts'
import type { Tracked } from '../hooks/watched.ts'

const issue = (key: string, updated: string, overrides: Partial<Issue> = {}): Issue => ({
  key,
  summary: `Задача ${key}`,
  status: 'To do',
  type: 'Task',
  priority: 'Medium',
  assignee: 'Борис',
  reporter: null,
  created: '2026-10-20T09:00:00.000+0300',
  updated,
  resolution: '',
  category: '',
  labels: [],
  components: [],
  watching: false,
  description: '',
  descFp: fingerprint(''),
  ...overrides,
})

const change = (text: string) => ({ kind: 'status', level: 'info', text }) as const

const list = (): Tracked[] => [
  trackedOf(issue('SUP-1', '2026-10-23T08:00:00.000+0300'), 'open', false),
  trackedOf(issue('SUP-2', '2026-10-23T09:00:00.000+0300'), 'progress', true, [change('новый комментарий')]),
  trackedOf(issue('SUP-3', '2026-10-23T10:00:00.000+0300'), 'open', false, [change('статус: A -> B')]),
  trackedOf(issue('SUP-4', '2026-10-23T11:00:00.000+0300', { resolution: 'Done', status: 'Closed' }), 'done', false),
  trackedOf(issue('SUP-5', '2026-10-23T12:00:00.000+0300'), 'progress', true),
]

describe('overviewOf', () => {
  test('порядок: ждёт вас, есть новое, без изменений, закрыто; внутри - свежие обновления первыми', () => {
    const rows = overviewOf(list()).rows

    assert.deepEqual(rows.map(row => row.key), ['SUP-2', 'SUP-3', 'SUP-5', 'SUP-1', 'SUP-4'])
    assert.deepEqual(rows.map(row => row.attention), ['act', 'fresh', 'live', 'live', 'idle'])
  })

  test('итог считается по всему набору, а не по отбору', () => {
    const view = overviewOf(list(), 'done')

    assert.equal(view.rows.length, 1)
    assert.equal(view.total, 5)
    assert.equal(view.progress, 2)
    assert.equal(view.open, 2)
    assert.equal(view.done, 1)
    assert.equal(view.mine, 2)
    assert.equal(view.act, 1)
    assert.equal(view.fresh, 2)
  })

  test('отборы', () => {
    const keys = (filter: Parameters<typeof overviewOf>[1]) => overviewOf(list(), filter).rows.map(row => row.key).sort()

    assert.deepEqual(keys('progress'), ['SUP-2', 'SUP-5'])
    assert.deepEqual(keys('open'), ['SUP-1', 'SUP-3'])
    assert.deepEqual(keys('mine'), ['SUP-2', 'SUP-5'])
    assert.deepEqual(keys('fresh'), ['SUP-2', 'SUP-3'])
    assert.deepEqual(keys('done'), ['SUP-4'])
  })

  test('закрытая задача, даже мои, в «мои» не входит и не ждёт', () => {
    const set = [trackedOf(issue('SUP-9', '2026-10-23T08:00:00.000+0300', { resolution: 'Done' }), 'done', true, [change('закрыта')])]

    assert.equal(overviewOf(set, 'mine').rows.length, 0)
    assert.equal(overviewOf(set).rows[0]?.attention, 'idle')
  })

  test('причина строки - последнее непросмотренное, иначе статус', () => {
    const rows = overviewOf(list()).rows

    assert.equal(rows.find(row => row.key === 'SUP-2')?.reason, 'новый комментарий')
    assert.equal(rows.find(row => row.key === 'SUP-1')?.reason, 'To do')
    assert.equal(rows.find(row => row.key === 'SUP-4')?.reason, 'закрыта: Closed')
  })

  test('filterOf: неизвестное - запасное', () => {
    assert.equal(filterOf('mine', 'all'), 'mine')
    assert.equal(filterOf('?', 'all'), 'all')
  })
})

describe('тексты для модели', () => {
  const input = { filter: 'all' as const, scopeWord: 'весь проект', project: 'SUP', truncated: false }

  test('список: итог, строка на задачу, легенда значков', () => {
    const text = overviewText(overviewOf(list()), input)

    assert.match(text, /^Jira SUP - весь проект: всего 5, в работе 2, открытых 2, мои 2, 1 ждут вас, с новым 2, закрыто 1\./)
    assert.match(text, /^! SUP-2  новый комментарий  \(To do; вы\)/m)
    assert.match(text, /^v SUP-4/m)
    assert.match(text, /! ждёт вас, \* есть новое/)
  })

  test('пустой набор - подсказка, а не пустая строка', () => {
    assert.match(overviewText(overviewOf([]), input), /Задач в наблюдении нет/)
  })

  test('обрезанный лимитом список говорит об этом', () => {
    assert.match(overviewText(overviewOf(list()), { ...input, truncated: true }), /обрезан лимитом/)
  })

  test('отбор назван', () => {
    assert.match(overviewText(overviewOf(list(), 'mine'), { ...input, filter: 'mine' }), /Показано: мои, 2\./)
  })

  test('строка: ветка видна, когда мод её завёл', () => {
    const entry = trackedOf(issue('SUP-7', '2026-10-23T08:00:00.000+0300'), 'progress', true)

    entry.branch = 'feature/SUP-7-x'

    assert.match(rowText(overviewOf([entry]).rows[0]!), /\[feature\/SUP-7-x\]/)
  })

  test('итог словами', () => {
    assert.match(tallyText(overviewOf(list())), /^всего 5, в работе 2/)
  })

  test('issueText: новое с прошлого просмотра и ветка', () => {
    const entry = list()[1]!

    entry.branch = 'feature/SUP-2-x'

    const text = issueText(entry, 'https://j/browse/SUP-2')

    assert.match(text, /Новое с прошлого просмотра:\n- новый комментарий/)
    assert.match(text, /Ветка: feature\/SUP-2-x/)
  })

  test('commentsText: не загружены / нет / есть с пометкой «из»', () => {
    const entry = list()[0]!

    assert.match(commentsText(entry), /ещё не загружены/)

    entry.detail = { issue: entry.issue, comments: [], total: 0, baseUrl: '' }

    assert.match(commentsText(entry), /комментариев нет/)

    entry.detail = {
      issue: entry.issue,
      total: 12,
      baseUrl: '',
      comments: [{ id: '1', author: 'Анна', login: 'a', email: '', created: '2026-10-23T10:04:52.000+0300', text: 'привет\u001b[31m' }],
    }

    const text = commentsText(entry)

    assert.match(text, /показаны последние 1 из 12/)
    assert.match(text, /Анна, 2026-10-23 10:04:\nпривет$/)
  })
})
