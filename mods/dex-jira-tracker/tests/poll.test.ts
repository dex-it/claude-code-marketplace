// Что делает один опрос с набором: первая загрузка молчит, дальше видны новые
// задачи, смены, назначение на вас и задачи, у которых сдвинулся updated.
// Источник подменён, поэтому проверка идёт без сети и без jira.
//
//   node --test mods/dex-jira-tracker/tests

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { Source } from '../hooks/backend.ts'
import type { Comment, Detail, Issue } from '../hooks/jira.ts'
import { fingerprint, parseTime } from '../hooks/jira.ts'
import { applyComments, applyPoll, pollSource } from '../hooks/poll.ts'
import type { Poll } from '../hooks/poll.ts'
import { queriesOf } from '../hooks/scope.ts'
import { trackedOf } from '../hooks/watched.ts'
import type { Tracked } from '../hooks/watched.ts'

const issue = (key: string, overrides: Partial<Issue> = {}): Issue => ({
  key,
  summary: `Задача ${key}`,
  status: 'To do',
  type: 'Task',
  priority: 'Medium',
  assignee: null,
  reporter: 'Борис',
  created: '2026-10-20T09:00:00.000+0300',
  updated: '2026-10-23T09:00:00.000+0300',
  resolution: '',
  category: '',
  labels: [],
  components: [],
  watching: false,
  description: '',
  descFp: fingerprint(''),
  ...overrides,
})

/** Открытые - все, кроме названных закрытыми: так выглядит выдача запроса `statusCategory != Done`. */
const poll = (issues: Issue[], progress: string[] = [], mine: string[] = [], done: string[] = []): Poll => ({
  issues,
  open: new Set(issues.map(i => i.key).filter(key => !done.includes(key))),
  progress: new Set(progress),
  mine: new Set(mine),
})

const held = (...issues: Issue[]) => new Map<string, Tracked>(issues.map(i => [i.key, trackedOf(i, 'open', false)]))

describe('applyPoll', () => {
  test('первая загрузка заполняет набор и молчит', () => {
    const out = applyPoll(new Map(), poll([issue('SUP-1'), issue('SUP-2')], ['SUP-2'], ['SUP-1']), true)

    assert.deepEqual([...out.next.keys()], ['SUP-1', 'SUP-2'])
    assert.equal(out.next.get('SUP-1')?.mine, true)
    assert.equal(out.next.get('SUP-2')?.group, 'progress')
    assert.deepEqual(out.announced, [])
    assert.deepEqual(out.look, [])
    assert.deepEqual(out.next.get('SUP-1')?.fresh, [])
  })

  test('новая задача после первой загрузки - новость, и помечена новой', () => {
    const out = applyPoll(held(issue('SUP-1')), poll([issue('SUP-1'), issue('SUP-9', { type: 'Bug' })]), false)

    assert.deepEqual(out.announced.map(a => a.key), ['SUP-9'])
    assert.equal(out.announced[0]?.changes[0]?.kind, 'created')
    assert.equal(out.next.get('SUP-9')?.fresh.length, 1)
  })

  test('смена статуса попадает и в объявления, и в fresh задачи', () => {
    const out = applyPoll(held(issue('SUP-1')), poll([issue('SUP-1', { status: 'В работе' })], ['SUP-1']), false)

    assert.equal(out.announced[0]?.changes[0]?.text, 'статус: To do -> В работе')
    assert.equal(out.next.get('SUP-1')?.group, 'progress')
    assert.equal(out.next.get('SUP-1')?.fresh.length, 1)
  })

  test('назначение на вас: было не моё, стало моё', () => {
    const out = applyPoll(held(issue('SUP-1')), poll([issue('SUP-1', { assignee: 'Анна' })], [], ['SUP-1']), false)

    assert.equal(out.announced[0]?.changes[0]?.text, 'назначена на вас')
    assert.equal(out.next.get('SUP-1')?.mine, true)
  })

  test('сдвинулся updated - задача идёт на поиск комментариев, с прежним updated как границей', () => {
    const before = issue('SUP-1')
    const after = issue('SUP-1', { updated: '2026-10-23T11:00:00.000+0300' })
    const out = applyPoll(held(before), poll([after]), false)

    assert.deepEqual(out.announced, [])
    assert.deepEqual(out.look, [{ key: 'SUP-1', sinceMs: parseTime(before.updated) }])
  })

  test('закрытая задача на поиск комментариев не идёт, а закрытие объявляется - даже без resolution', () => {
    const out = applyPoll(
      held(issue('SUP-1')),
      poll([issue('SUP-1', { updated: '2026-10-23T11:00:00.000+0300', status: 'Closed' })], [], [], ['SUP-1']),
      false,
    )

    assert.deepEqual(out.look, [])
    assert.equal(out.next.get('SUP-1')?.group, 'done')
    assert.equal(out.announced[0]?.changes[0]?.kind, 'resolved')
  })

  test('задача с пустым resolution в закрытом статусе не считается открытой', () => {
    const out = applyPoll(new Map(), poll([issue('SUP-1', { status: 'Closed', resolution: '' })], [], [], ['SUP-1']), true)

    assert.equal(out.next.get('SUP-1')?.group, 'done')
  })

  test('задача, ушедшая из выдачи, уходит из набора молча', () => {
    const out = applyPoll(held(issue('SUP-1'), issue('SUP-2')), poll([issue('SUP-2')]), false)

    assert.deepEqual([...out.next.keys()], ['SUP-2'])
    assert.deepEqual(out.announced, [])
  })

  test('непросмотренное копится от опроса к опросу, а не затирается', () => {
    const first = applyPoll(held(issue('SUP-1')), poll([issue('SUP-1', { status: 'A' })]), false)
    const second = applyPoll(first.next, poll([issue('SUP-1', { status: 'B' })]), false)

    assert.equal(second.next.get('SUP-1')?.fresh.length, 2)
  })

  test('detail прежнего состояния сбрасывается: он описывал задачу, какой она была', () => {
    const base = held(issue('SUP-1'))
    const entry = base.get('SUP-1')

    assert.ok(entry)

    entry.detail = { issue: issue('SUP-1'), comments: [], total: 0, baseUrl: '' }

    assert.equal(applyPoll(base, poll([issue('SUP-1')]), false).next.get('SUP-1')?.detail, undefined)
  })
})

describe('applyComments', () => {
  const comment = (id: string, login: string, created: string): Comment => ({
    id,
    author: login,
    login,
    email: '',
    created,
    text: `комментарий ${id}`,
  })

  test('новые комментарии чужих пишутся в fresh, свои - нет, detail запоминается', () => {
    const entry = trackedOf(issue('SUP-1'), 'open', false)
    const detail: Detail = {
      issue: issue('SUP-1'),
      comments: [
        comment('1', 'old', '2026-10-23T08:00:00.000+0300'),
        comment('2', 'colleague', '2026-10-23T10:00:00.000+0300'),
        comment('3', 'me', '2026-10-23T10:01:00.000+0300'),
      ],
      total: 3,
      baseUrl: '',
    }
    const added = applyComments(entry, detail, parseTime('2026-10-23T09:00:00.000+0300'), 'me')

    assert.equal(added.length, 1)
    assert.equal(entry.fresh.length, 1)
    assert.equal(entry.detail, detail)
  })
})

describe('pollSource', () => {
  const calls: string[] = []
  const source = {
    list: async (jql: string) => {
      calls.push(`list:${jql}`)

      return { issues: [issue('SUP-1')], truncated: false }
    },
    keys: async (jql: string) => {
      calls.push(`keys:${jql}`)

      return new Set(['SUP-1'])
    },
  } as unknown as Source

  test('четыре вопроса за опрос: задачи, какие открыты, какие в работе, какие мои', async () => {
    const built = queriesOf({ scope: 'project', jql: '', doneDays: 1 })

    assert.ok(built.queries)

    const out = await pollSource(source, built.queries, 50)

    assert.equal(calls.length, 4)
    assert.ok(calls.some(call => call.startsWith('list:')))
    assert.equal(calls.filter(call => call.startsWith('keys:')).length, 3)
    assert.deepEqual(out.poll.issues.map(i => i.key), ['SUP-1'])
    assert.equal(out.poll.mine.has('SUP-1'), true)
  })
})
