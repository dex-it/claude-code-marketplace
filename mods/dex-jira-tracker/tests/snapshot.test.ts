// Снимок набора между сессиями: сохраняется без текста описаний, читается
// осторожно (в store лежит то, что записала любая прежняя версия мода).
//
//   node --test mods/dex-jira-tracker/tests

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { Issue } from '../hooks/jira.ts'
import { fingerprint } from '../hooks/jira.ts'
import { SNAPSHOT_MAX_AGE_MS, fromSnapshot, snapshotKey, toSnapshot } from '../hooks/snapshot.ts'
import { trackedOf } from '../hooks/watched.ts'

const issue = (key: string): Issue => ({
  key,
  summary: 'Задача',
  status: 'To do',
  type: 'Task',
  priority: 'Medium',
  assignee: 'Анна',
  reporter: null,
  created: '2026-10-20T09:00:00.000+0300',
  updated: '2026-10-23T09:00:00.000+0300',
  resolution: '',
  category: '',
  labels: ['a'],
  components: [],
  watching: true,
  description: 'длинный текст описания',
  descFp: fingerprint('длинный текст описания'),
})

describe('snapshot', () => {
  const entry = trackedOf(issue('SUP-1'), 'progress', true, [{ kind: 'status', level: 'info', text: 'статус: A -> B' }])

  entry.branch = 'feature/SUP-1-x'

  const set = new Map([[entry.key, entry]])

  test('туда и обратно: группа, моё, непросмотренное и ветка сохраняются', () => {
    const back = fromSnapshot(JSON.parse(JSON.stringify(toSnapshot(set, 1000))), 2000)
    const got = back?.get('SUP-1')

    assert.equal(got?.group, 'progress')
    assert.equal(got?.mine, true)
    assert.equal(got?.branch, 'feature/SUP-1-x')
    assert.deepEqual(got?.fresh, entry.fresh)
    assert.equal(got?.issue.assignee, 'Анна')
  })

  test('текст описания не хранится, отпечаток - да', () => {
    const body = toSnapshot(set, 1000).items[0]

    assert.equal(body?.issue.description, '')
    assert.equal(body?.issue.descFp, fingerprint('длинный текст описания'))
  })

  test('старый снимок - не прежнее состояние, а повод начать заново', () => {
    const old = JSON.parse(JSON.stringify(toSnapshot(set, 1000)))

    assert.equal(fromSnapshot(old, 1000 + SNAPSHOT_MAX_AGE_MS + 1), null)
    assert.notEqual(fromSnapshot(old, 1000 + SNAPSHOT_MAX_AGE_MS), null)
  })

  test('чужое и сломанное читается как отсутствие, а не падением', () => {
    for (const junk of [undefined, null, 'x', 5, {}, { v: 2, savedMs: 1, items: [] }, { v: 1, savedMs: 'a', items: [] }, { v: 1, savedMs: 1, items: 'x' }]) {
      assert.equal(fromSnapshot(junk, 2), null)
    }

    const half = { v: 1, savedMs: 1, items: [{ issue: { key: '' } }, { issue: { key: 'SUP-2' }, group: 'nope' }, { issue: { key: 'SUP-3' }, group: 'open' }] }

    assert.deepEqual([...(fromSnapshot(half, 2)?.keys() ?? [])], ['SUP-3'])
  })

  test('ключ снимка зависит от охвата и чист от странных знаков', () => {
    assert.notEqual(snapshotKey({ project: 'SUP', scope: 'project', jql: '' }), snapshotKey({ project: 'SUP', scope: 'mine', jql: '' }))
    assert.notEqual(snapshotKey({ project: '', scope: 'jql', jql: 'a = 1' }), snapshotKey({ project: '', scope: 'jql', jql: 'a = 2' }))
    assert.equal(snapshotKey({ project: 'SUP', scope: 'project', jql: 'a = 1' }), snapshotKey({ project: 'SUP', scope: 'project', jql: 'b = 2' }))
    assert.match(snapshotKey({ project: '', scope: 'jql', jql: 'x\u0000\n"y"' }), /^snapshot:[ -~]*$/)
  })
})
