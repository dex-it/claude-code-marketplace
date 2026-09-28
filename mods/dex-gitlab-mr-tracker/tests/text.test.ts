// Тексты, которые читает модель: состояние MR и его открытые треды.
// Проверяются прогоном, потому что именно они - обещание мода отдать текстом
// всё, что он нарисовал человеку; в живой сессии их дефект выглядит как
// «модель не увидела замечания», а не как падение.
//
//   node --test mods/dex-gitlab-mr-tracker/tests

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { MrData } from '../hooks/gitlab.ts'
import { mrDataOf, threadsOf } from '../hooks/gitlab.ts'
import { THREADS_TEXT_MAX_CHARS, noMrText, statusText, threadsText } from '../hooks/text.ts'
import type { Watched } from '../hooks/watched.ts'
import {
  openThreadsOf,
  plainThreadsOf,
  resolvedThreadsOf,
  watchedOf,
} from '../hooks/watched.ts'

const WEB = 'https://gitlab.example.com/group/sub/proj/-/merge_requests/7'
const REF = { host: 'gitlab.example.com', project: 'group/sub/proj', iid: 7 }

// Состояния резолва GitLab держит на заметке, а не на обсуждении, и адрес в
// диффе - тоже: `position` есть только у первой заметки треда.
const noteOf = (over: Record<string, unknown> = {}) => ({
  id: 11,
  body: 'Здесь гонка',
  author: { username: 'reviewer' },
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
  resolvable: true,
  resolved: false,
  system: false,
  position: { new_path: 'src/queue.ts', new_line: 42 },
  ...over,
})

const discussionOf = (over: Record<string, unknown> = {}) => ({
  id: 'd1',
  individual_note: false,
  notes: [
    noteOf(),
    // Последний комментатор и время последнего комментария - с хвостовой заметки.
    noteOf({ id: 12, author: { username: 'author' }, updated_at: '2026-09-20T11:00:00Z' }),
  ],
  ...over,
})

const mrOf = (over: Record<string, unknown> = {}) => ({
  iid: 7,
  title: 'Фикс гонки в очереди',
  state: 'opened',
  draft: false,
  author: { username: 'alice' },
  source_branch: 'fix/race',
  target_branch: 'main',
  web_url: WEB,
  detailed_merge_status: 'mergeable',
  has_conflicts: false,
  blocking_discussions_resolved: true,
  changes_count: '8',
  user_notes_count: 12,
  labels: ['bug'],
  reviewers: [{ username: 'bob' }],
  assignees: [{ username: 'alice' }],
  head_pipeline: { status: 'success', web_url: 'https://gitlab.example.com/p/1' },
  sha: 'aaaa1111',
  updated_at: '2026-09-20T12:00:00Z',
  ...over,
})

type Poll = Parameters<typeof mrDataOf>[0]

const COMMITS = [
  { short_id: 'abc1234', title: 'fix: race', author_name: 'Alice' },
  { short_id: 'bcd2345', title: 'test: race', author_name: 'Alice' },
  { short_id: 'cde3456', title: 'docs: race', author_name: 'Alice' },
]

const dataOf = (over: Record<string, unknown> = {}, poll: Partial<Poll> = {}): MrData =>
  mrDataOf({
    mr: mrOf(over),
    discussions: [discussionOf()],
    commits: COMMITS,
    approvals: {
      approvals_required: 2,
      approvals_left: 1,
      approved_by: [{ user: { username: 'bob' } }],
    },
    commitsPageSize: 100,
    ...poll,
  })

const entryOf = (
  over: Record<string, unknown> = {},
  poll: Partial<Poll> = {},
  error?: string,
): Watched => ({
  ...watchedOf(REF, true),
  data: dataOf(over, poll),
  ...(error === undefined ? {} : { error }),
})

describe('statusText', () => {
  test('one fact per line, and the label carries the title', () => {
    const lines = statusText(entryOf()).split('\n')

    assert.equal(lines[0], '**proj!7** - Фикс гонки в очереди')
    assert.equal(lines[1], '')
    assert.ok(lines.includes('- Состояние: opened'))
    assert.ok(lines.includes('- Ветки: fix/race -> main'))
    assert.ok(lines.includes('- Автор: alice'))
    assert.ok(lines.includes('- Merge: mergeable'))
    assert.ok(lines.includes('- Пайплайн: success'))
    assert.ok(lines.includes('- Апрувы: 1/2 (bob)'))
    assert.ok(lines.includes('- Треды: 1 открытых из 1'))
    assert.ok(lines.includes('- Комментарии: 12'))
    assert.ok(lines.includes('- Коммиты: 3'))
    assert.ok(lines.includes('- Файлов изменено: 8'))
    assert.ok(lines.includes('- Ревьюеры: bob'))
    assert.ok(lines.includes('- Метки: bug'))
    assert.ok(lines.includes(`- Ссылка: ${WEB}`))
  })

  test('a draft is named draft, not opened', () => {
    assert.ok(statusText(entryOf({ draft: true })).includes('- Состояние: draft'))
  })

  test('conflicts are named beside the merge status', () => {
    assert.ok(
      statusText(
        entryOf({ has_conflicts: true, detailed_merge_status: 'conflict' }),
      ).includes('- Merge: conflict, есть конфликты'),
    )
  })

  test('a filled commit page is counted as a floor, not a total', () => {
    // Страница коммитов набилась целиком: счётчик - «не меньше», и текст это
    // говорит плюсом, а не выдаёт floor за итог.
    assert.ok(statusText(entryOf({}, { commitsPageSize: 3 })).includes('- Коммиты: 3+'))
  })

  test('a fact nobody stated is left out instead of drawn as zero', () => {
    const text = statusText(
      entryOf(
        { labels: [], reviewers: [], changes_count: '' },
        // Инстанс без платных правил апрува отвечает про апрувы, но без квоты
        // и без проголосовавших: рисовать тут нечего.
        { discussions: [], approvals: { approved_by: [] } },
      ),
    )

    assert.equal(text.includes('- Апрувы'), false)
    assert.equal(text.includes('- Метки'), false)
    assert.equal(text.includes('- Ревьюеры'), false)
    assert.equal(text.includes('- Файлов изменено'), false)
    assert.equal(text.includes('- Обсуждения без резолва'), false)
    assert.ok(text.includes('- Треды: 0 открытых из 0'))
  })

  test('a discussion nobody can resolve is counted on its own line', () => {
    const text = statusText(
      entryOf(
        {},
        {
          discussions: [
            discussionOf({
              id: 'plain',
              notes: [noteOf({ resolvable: false, position: {} })],
            }),
          ],
        },
      ),
    )

    assert.ok(text.includes('- Обсуждения без резолва: 1'))
    assert.ok(text.includes('- Треды: 0 открытых из 0'))
  })

  test('a failed poll is a line, and the previous facts stay beside it', () => {
    const text = statusText(entryOf({}, {}, 'GitLab ответил 502'))

    assert.ok(text.includes('- Последний опрос: не удался: GitLab ответил 502'))
    assert.ok(text.includes('- Состояние: opened'))
  })

  test('with no data at all the label and the reason are the whole answer', () => {
    const empty: Watched = { ...watchedOf(REF, true), error: 'нет токена' }

    assert.equal(statusText(empty), '**proj!7** - нет токена')
    assert.equal(statusText(watchedOf(REF, true)), '**proj!7** - данных ещё нет')
  })
})

describe('threadsText', () => {
  test('every open thread is addressed by file, line, author and link', () => {
    const text = threadsText(entryOf())

    assert.ok(text.startsWith(`**Открытые треды proj!7** - 1 из 1\n${WEB}\n`))
    assert.ok(text.includes('- **src/queue.ts:42**'))
    assert.ok(text.includes('  reviewer, комментариев 2, последний от author'))
    assert.ok(text.includes('  Здесь гонка'))
    assert.ok(text.includes(`  ${WEB}#note_11`))
  })

  test('a thread on no file at all is named as discussion of the MR', () => {
    const text = threadsText(
      entryOf(
        {},
        { discussions: [discussionOf({ notes: [noteOf({ position: {} })] })] },
      ),
    )

    assert.ok(text.includes('- **обсуждение MR**'))
  })

  test('no open threads is said, and the closed ones are counted', () => {
    const text = threadsText(
      entryOf(
        {},
        { discussions: [discussionOf({ notes: [noteOf({ resolved: true })] })] },
      ),
    )

    assert.equal(text, 'proj!7: открытых тредов нет (закрыто 1)')
  })

  test('a discussion longer than the prompt allows is cut, and the cut is named', () => {
    const discussions = Array.from({ length: 5 }, (_, index) =>
      discussionOf({
        id: `d${index}`,
        notes: [
          noteOf({
            id: 100 + index,
            position: { new_path: 'src/queue.ts', new_line: index + 1 },
          }),
        ],
      }),
    )
    const entry = entryOf({}, { discussions })
    const full = threadsText(entry)

    // Штатного лимита на пять тредов хватает: обрезка - про лимит, не про число.
    assert.ok(full.startsWith('**Открытые треды proj!7** - 5 из 5'))
    assert.equal(full.includes('- ... ещё'), false)
    assert.ok(full.length < THREADS_TEXT_MAX_CHARS)

    const cut = threadsText(entry, 400)

    assert.ok(cut.includes(`- ... ещё 4 тредов, см. ${WEB}`))
    assert.ok(cut.includes('- **src/queue.ts:1**'))
    assert.equal(cut.includes('- **src/queue.ts:5**'), false)
  })

  test('with no data at all the label and the reason are the whole answer', () => {
    assert.equal(threadsText(watchedOf(REF, true)), 'proj!7: данных ещё нет')
  })
})

describe('openThreadsOf, resolvedThreadsOf and plainThreadsOf', () => {
  const raw = [
    discussionOf({ id: 'new', notes: [noteOf({ updated_at: '2026-09-21T10:00:00Z' })] }),
    discussionOf({ id: 'closed', notes: [noteOf({ resolved: true })] }),
    // Нерезолвимый тред у GitLab - это обсуждение MR, а не diff-тред.
    discussionOf({ id: 'plain', notes: [noteOf({ resolvable: false, position: {} })] }),
    discussionOf({ id: 'old', notes: [noteOf({ updated_at: '2026-09-19T10:00:00Z' })] }),
  ]

  test('open threads come oldest answer first: that is what to answer next', () => {
    const data = dataOf({}, { discussions: raw })

    assert.deepEqual(
      openThreadsOf(data).map(thread => thread.id),
      ['old', 'new'],
    )
    assert.deepEqual(
      resolvedThreadsOf(data).map(thread => thread.id),
      ['closed'],
    )
    assert.deepEqual(
      plainThreadsOf(data).map(thread => thread.id),
      ['plain'],
    )
  })

  test('sorting does not move the list the poll handed over', () => {
    const data = dataOf({}, { discussions: raw })

    openThreadsOf(data)

    assert.deepEqual(data.threads, threadsOf(raw, WEB))
    assert.deepEqual(
      data.threads.map(thread => thread.id),
      ['new', 'closed', 'plain', 'old'],
    )
  })
})

describe('noMrText', () => {
  test('the answer names both ways to get a merge request on screen', () => {
    assert.ok(noMrText.includes('/mr 123'))
    assert.ok(noMrText.includes('ссылк'))
  })
})
