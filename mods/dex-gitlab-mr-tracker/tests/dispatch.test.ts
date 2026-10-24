// Поручения, которые мод отдаёт по кнопке: какие треды берутся и что в тексте
// для агента. Агент стартует с пустым контекстом, поэтому в тексте должно быть
// всё, и это проверяется здесь, а не в сессии.

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { fixPrompt, pickThreads, reviewPrompt } from '../hooks/dispatch.ts'
import { mrDataOf } from '../hooks/gitlab.ts'
import type { Watched } from '../hooks/watched.ts'
import { watchedOf } from '../hooks/watched.ts'

const WEB = 'https://gitlab.example.com/group/proj/-/merge_requests/7'
const REF = { host: 'gitlab.example.com', project: 'group/proj', iid: 7 }

const discussion = (id: string, over: { resolved?: boolean; resolvable?: boolean } = {}) => ({
  id,
  individual_note: false,
  notes: [
    {
      id: id.charCodeAt(0),
      body: `замечание ${id}`,
      author: { username: 'reviewer' },
      created_at: '2026-09-20T10:00:00Z',
      updated_at: '2026-09-20T10:00:00Z',
      resolvable: over.resolvable ?? true,
      resolved: over.resolved ?? false,
      system: false,
      position: { new_path: `src/${id}.ts`, new_line: 10 },
    },
  ],
})

const entryOf = (discussions: unknown[], state = 'opened'): Watched => ({
  ...watchedOf(REF, false),
  data: mrDataOf({
    mr: {
      iid: 7,
      title: 'Фикс гонки',
      state,
      source_branch: 'fix/race',
      target_branch: 'main',
      web_url: WEB,
    },
    discussions,
    commits: [],
    approvals: undefined,
    commitsPageSize: 100,
  }),
})

describe('pickThreads', () => {
  test('all takes every open thread and leaves the resolved and the plain ones', () => {
    const entry = entryOf([
      discussion('a'),
      discussion('b', { resolved: true }),
      discussion('c', { resolvable: false }),
    ])
    const pick = pickThreads(entry, 'all')

    assert.ok(pick.ok)
    assert.deepEqual(pick.threads.map(thread => thread.id), ['a'])
  })

  test('a number is the place among the open threads, as /mr threads counts them', () => {
    const pick = pickThreads(
      entryOf([discussion('a'), discussion('b', { resolved: true }), discussion('c')]),
      2,
    )

    assert.ok(pick.ok)
    assert.deepEqual(pick.threads.map(thread => thread.id), ['c'])
  })

  test('a number past the end says how many there are', () => {
    const pick = pickThreads(entryOf([discussion('a')]), 5)

    assert.ok(!pick.ok)
    assert.ok(pick.reason.includes('тред 5 не найден, открытых 1'))
  })

  test('no open threads, a merged MR and no data are each said, not sent to an agent', () => {
    const none = pickThreads(entryOf([discussion('a', { resolved: true })]), 'all')
    const merged = pickThreads(entryOf([discussion('a')], 'merged'), 'all')
    const empty = pickThreads(watchedOf(REF, false), 'all')

    assert.ok(!none.ok && none.reason.includes('открытых тредов нет'))
    assert.ok(!merged.ok && merged.reason.includes('MR не открыт'))
    assert.ok(!empty.ok && empty.reason.includes('данных ещё нет'))
  })
})

describe('reviewPrompt', () => {
  test('the command and the link, with one slash however the setting is written', () => {
    assert.equal(reviewPrompt('mr-review', entryOf([])), `/mr-review ${WEB}`)
    assert.equal(reviewPrompt('/mr-review', entryOf([])), `/mr-review ${WEB}`)
  })

  test('no data means no prompt', () => {
    assert.equal(reviewPrompt('mr-review', watchedOf(REF, false)), null)
  })
})

describe('fixPrompt', () => {
  const entry = entryOf([discussion('a'), discussion('b')])
  const pick = pickThreads(entry, 'all')

  test('carries the branch, every thread with its address and the link', () => {
    assert.ok(pick.ok)

    const text = fixPrompt(entry, pick.threads, { push: false })

    assert.ok(text.includes('fix/race -> main'))
    assert.ok(text.includes('src/a.ts:10'))
    assert.ok(text.includes('src/b.ts:10'))
    assert.ok(text.includes(WEB))
    assert.ok(text.includes('worktree'))
  })

  test('never resolves threads or answers in them', () => {
    assert.ok(pick.ok)
    assert.ok(fixPrompt(entry, pick.threads, { push: true }).includes('Треды не резолви и в MR не отвечай'))
  })

  test('push is allowed into the MR branch only when the setting says so', () => {
    assert.ok(pick.ok)

    const local = fixPrompt(entry, pick.threads, { push: false })
    const pushed = fixPrompt(entry, pick.threads, { push: true })

    assert.ok(local.includes('Запушить нельзя'))
    assert.ok(!local.includes('Запушь коммиты'))
    assert.ok(pushed.includes('Запушь коммиты в ветку fix/race этого же MR'))
  })
})
