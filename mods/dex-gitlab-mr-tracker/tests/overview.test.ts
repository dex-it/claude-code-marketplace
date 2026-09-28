// Общий список наблюдения: правило внимания по каждому MR, порядок строк и
// итог сверху - плюс тот же список текстом. Предмет прогона - суждение «что
// из этого ждёт меня»: в живой сессии его дефект выглядит как «список молчит
// о конфликте», а не как падение, поэтому проверяется здесь, а не глазами.
//
//   node --test mods/dex-gitlab-mr-tracker/tests

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { MrData, MrRef } from '../hooks/gitlab.ts'
import { mrDataOf } from '../hooks/gitlab.ts'
import type { Attention } from '../hooks/overview.ts'
import { ATTENTION_MANY, ATTENTION_ONE, overviewOf } from '../hooks/overview.ts'
import { overviewText } from '../hooks/text.ts'
import type { Watched } from '../hooks/watched.ts'
import { watchedOf } from '../hooks/watched.ts'

const HOST = 'gitlab.example.com'

const refOf = (project: string, iid: number, host = HOST): MrRef => ({ host, project, iid })

const webOf = (ref: MrRef) =>
  `https://${ref.host}/${ref.project}/-/merge_requests/${ref.iid}`

// Состояния резолва GitLab держит на заметке, а не на обсуждении: тред
// считается открытым по своим резолвимым заметкам.
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
  notes: [noteOf()],
  ...over,
})

/** Ровно `count` открытых тредов, каждый со своим id. */
const openThreads = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    discussionOf({ id: `d${index}`, notes: [noteOf({ id: 100 + index })] }),
  )

const mrOf = (ref: MrRef, over: Record<string, unknown> = {}) => ({
  iid: ref.iid,
  title: 'Фикс гонки в очереди',
  state: 'opened',
  draft: false,
  author: { username: 'alice' },
  source_branch: 'fix/race',
  target_branch: 'main',
  web_url: webOf(ref),
  detailed_merge_status: 'mergeable',
  has_conflicts: false,
  blocking_discussions_resolved: true,
  changes_count: '8',
  user_notes_count: 12,
  labels: ['bug'],
  reviewers: [{ username: 'bob' }],
  assignees: [{ username: 'alice' }],
  head_pipeline: { status: 'success', web_url: `https://${ref.host}/p/1` },
  sha: 'aaaa1111',
  updated_at: '2026-09-20T12:00:00Z',
  ...over,
})

type Poll = Parameters<typeof mrDataOf>[0]

/** Инстанс с платными правилами апрува: квота есть, один голос подан. */
const APPROVALS = {
  approvals_required: 2,
  approvals_left: 1,
  approved_by: [{ user: { username: 'bob' } }],
}

const dataOf = (
  ref: MrRef,
  over: Record<string, unknown> = {},
  poll: Partial<Poll> = {},
): MrData =>
  mrDataOf({
    mr: mrOf(ref, over),
    discussions: [],
    commits: [{ short_id: 'abc1234', title: 'fix: race', author_name: 'Alice' }],
    approvals: APPROVALS,
    commitsPageSize: 100,
    ...poll,
  })

/** Наблюдаемый MR, по которому опрос уже ответил. */
const entryOf = (
  ref: MrRef,
  over: Record<string, unknown> = {},
  poll: Partial<Poll> = {},
  error?: string,
): Watched => ({
  ...watchedOf(ref, true),
  data: dataOf(ref, over, poll),
  ...(error === undefined ? {} : { error }),
})

/** Запись без данных вовсе: первый опрос ещё идёт либо не прошёл. */
const blankOf = (ref: MrRef, error?: string): Watched => ({
  ...watchedOf(ref, true),
  ...(error === undefined ? {} : { error }),
})

/** Строка списка одного MR: она всегда одна, список собран здесь же. */
const rowOf = (entry: Watched) => {
  const [row] = overviewOf([entry]).rows

  assert.ok(row, 'список из одной записи даёт одну строку')

  return row
}

/**
 * Список вперемешку: два хоста, запись с ошибкой опроса рядом с данными и
 * запись, по которой данных нет вовсе. На нём считаются итог и шапка текста.
 */
const mixedList = (): Watched[] => [
  entryOf(refOf('group/one', 1), {}, { discussions: openThreads(2) }),
  entryOf(refOf('group/two', 2)),
  entryOf(
    refOf('group/three', 3, 'gl.corp'),
    {},
    { discussions: openThreads(1) },
    'GitLab ответил 502',
  ),
  blankOf(refOf('group/four', 4, 'gl.corp'), 'нет токена'),
  entryOf(refOf('group/five', 5), { state: 'merged', detailed_merge_status: 'not_open' }),
]

const REF = refOf('group/sub/proj', 7)

describe('overviewOf: правило внимания', () => {
  test('a closed or a merged MR waits for nobody', () => {
    for (const state of ['closed', 'merged']) {
      const row = rowOf(entryOf(REF, { state, detailed_merge_status: 'not_open' }))

      assert.equal(row.attention, 'idle', state)
      assert.equal(row.why, null, state)
    }
  })

  test('a merge status that needs work is the reason itself', () => {
    for (const status of ['conflict', 'need_rebase']) {
      const row = rowOf(entryOf(REF, { detailed_merge_status: status }))

      assert.equal(row.attention, 'act', status)
      assert.equal(row.why, status)
    }
  })

  test('a red pipeline names the pipeline and its status', () => {
    for (const status of ['failed', 'canceled']) {
      const row = rowOf(
        entryOf(REF, { head_pipeline: { status, web_url: 'https://gl/p/2' } }),
      )

      assert.equal(row.attention, 'act', status)
      assert.equal(row.why, `пайплайн: ${status}`)
    }
  })

  test('open threads name their number', () => {
    const row = rowOf(entryOf(REF, {}, { discussions: openThreads(3) }))

    assert.equal(row.attention, 'act')
    assert.equal(row.why, '3 открытых тредов')
    assert.equal(row.threadsOpen, 3)
  })

  test('a draft with no reason waits for nobody, one with a reason still does', () => {
    const quiet = rowOf(entryOf(REF, { draft: true, detailed_merge_status: 'draft_status' }))

    assert.equal(quiet.attention, 'idle')
    assert.equal(quiet.why, null)
    // Черновик назван черновиком, а не открытым: это про то же суждение.
    assert.equal(quiet.state, 'draft')

    // Draft проверяется после причин: черновик с конфликтом ждёт автора.
    const broken = rowOf(entryOf(REF, { draft: true, detailed_merge_status: 'conflict' }))

    assert.equal(broken.attention, 'act')
    assert.equal(broken.why, 'conflict')
  })

  test('a gate that has not passed yet is named, and it is nobody work', () => {
    for (const status of ['ci_must_pass', 'not_approved']) {
      const row = rowOf(entryOf(REF, { detailed_merge_status: status }))

      assert.equal(row.attention, 'wait', status)
      assert.equal(row.why, status)
    }
  })

  test('mergeable with no threads waits, and names no reason at all', () => {
    const row = rowOf(entryOf(REF))

    assert.equal(row.attention, 'wait')
    assert.equal(row.why, null)
  })

  test('a record with no data is unknown, and the failed poll is its reason', () => {
    const failed = rowOf(blankOf(REF, 'нет токена'))

    assert.equal(failed.attention, 'unknown')
    assert.equal(failed.why, 'нет токена')
    assert.equal(failed.error, 'нет токена')

    // Первый опрос ещё идёт: ошибки нет, а пустой причины у строки не бывает -
    // про идущий опрос так и сказано словами.
    const polling = rowOf(blankOf(REF))

    assert.equal(polling.attention, 'unknown')
    assert.equal(polling.why, 'первый опрос идёт')
    assert.equal(polling.error, null)
  })
})

describe('overviewOf: приоритет причин', () => {
  test('a conflict outranks a red pipeline and open threads alike', () => {
    const row = rowOf(
      entryOf(
        REF,
        {
          detailed_merge_status: 'conflict',
          head_pipeline: { status: 'failed', web_url: '' },
        },
        { discussions: openThreads(2) },
      ),
    )

    assert.equal(row.attention, 'act')
    assert.equal(row.why, 'conflict')
  })

  test('a red pipeline outranks open threads', () => {
    const row = rowOf(
      entryOf(
        REF,
        {
          detailed_merge_status: 'ci_must_pass',
          head_pipeline: { status: 'failed', web_url: '' },
        },
        { discussions: openThreads(2) },
      ),
    )

    assert.equal(row.attention, 'act')
    assert.equal(row.why, 'пайплайн: failed')
  })
})

describe('overviewOf: порядок строк', () => {
  test('act first, then wait, unknown and idle; added order inside a group', () => {
    const overview = overviewOf([
      entryOf(refOf('group/wait-first', 1)),
      entryOf(refOf('group/act-first', 2), { detailed_merge_status: 'conflict' }),
      entryOf(refOf('group/idle', 3), { state: 'merged', detailed_merge_status: 'not_open' }),
      blankOf(refOf('group/unknown', 4)),
      entryOf(refOf('group/act-second', 5), {
        head_pipeline: { status: 'failed', web_url: '' },
      }),
      entryOf(refOf('group/wait-second', 6), { detailed_merge_status: 'ci_must_pass' }),
    ])

    assert.deepEqual(
      overview.rows.map(row => row.key),
      [
        'gitlab.example.com/group/act-first!2',
        'gitlab.example.com/group/act-second!5',
        'gitlab.example.com/group/wait-first!1',
        'gitlab.example.com/group/wait-second!6',
        'gitlab.example.com/group/unknown!4',
        'gitlab.example.com/group/idle!3',
      ],
    )
    assert.deepEqual(
      overview.rows.map(row => row.attention),
      ['act', 'act', 'wait', 'wait', 'unknown', 'idle'],
    )
  })
})

describe('overviewOf: итог', () => {
  test('every counter is read off the same list, hosts and failures included', () => {
    const overview = overviewOf(mixedList())

    assert.equal(overview.total, 5)
    assert.equal(overview.rows.length, 5)
    assert.equal(overview.act, 2)
    assert.equal(overview.wait, 1)
    assert.equal(overview.idle, 1)
    assert.equal(overview.unknown, 1)
    // Сумма по всем MR: два треда у одного и один у другого.
    assert.equal(overview.threadsOpen, 3)
    // Опрос не удался у двух: у одного данные прошлого опроса остались.
    assert.equal(overview.failed, 2)
    assert.equal(overview.hosts, 2)
  })

  test('an empty list counts nothing and draws nothing', () => {
    assert.deepEqual(overviewOf([]), {
      rows: [],
      total: 0,
      act: 0,
      wait: 0,
      idle: 0,
      unknown: 0,
      threadsOpen: 0,
      failed: 0,
      hosts: 0,
    })
  })
})

describe('overviewOf: поля строки', () => {
  test('a row carries the watched MR and the facts of its poll', () => {
    assert.deepEqual(rowOf(entryOf(REF)), {
      key: 'gitlab.example.com/group/sub/proj!7',
      label: 'proj!7',
      host: 'gitlab.example.com',
      attention: 'wait',
      title: 'Фикс гонки в очереди',
      webUrl: 'https://gitlab.example.com/group/sub/proj/-/merge_requests/7',
      state: 'opened',
      merge: 'mergeable',
      mergeLevel: 'good',
      ci: 'success',
      ciLevel: 'ok',
      threadsOpen: 0,
      threadsResolvable: 0,
      approvals: '1/2',
      why: null,
      error: null,
    })
  })

  test('a row with no data at all keeps only the address it was watched by', () => {
    assert.deepEqual(rowOf(blankOf(REF, 'GitLab ответил 502')), {
      key: 'gitlab.example.com/group/sub/proj!7',
      label: 'proj!7',
      host: 'gitlab.example.com',
      attention: 'unknown',
      title: '',
      webUrl: '',
      state: '',
      merge: '',
      mergeLevel: 'wait',
      ci: null,
      ciLevel: null,
      threadsOpen: 0,
      threadsResolvable: 0,
      approvals: null,
      why: 'GitLab ответил 502',
      error: 'GitLab ответил 502',
    })
  })

  test('approvals an instance says nothing about are left out, not drawn as zero', () => {
    assert.equal(rowOf(entryOf(REF, {}, { approvals: null })).approvals, null)
    // Инстанс без платных правил, где никто не апрувил, о них молчит.
    assert.equal(rowOf(entryOf(REF, {}, { approvals: { approved_by: [] } })).approvals, null)
    // Тот же инстанс, но голос подан: квоты нет, и рисуется только счёт.
    assert.equal(
      rowOf(entryOf(REF, {}, { approvals: { approved_by: [{ user: { username: 'bob' } }] } }))
        .approvals,
      '1',
    )
  })

  test('no pipeline at all is null, not a status nobody sent', () => {
    const row = rowOf(entryOf(REF, { head_pipeline: undefined }))

    assert.equal(row.ci, null)
    assert.equal(row.ciLevel, null)
  })
})

describe('ATTENTION_ONE и ATTENTION_MANY', () => {
  const ATTENTIONS: readonly Attention[] = ['act', 'wait', 'unknown', 'idle']

  test('both forms carry a word for every attention and nothing else', () => {
    assert.deepEqual(Object.keys(ATTENTION_ONE).sort(), [...ATTENTIONS].sort())
    assert.deepEqual(Object.keys(ATTENTION_MANY).sort(), [...ATTENTIONS].sort())

    for (const attention of ATTENTIONS) {
      assert.ok(ATTENTION_ONE[attention].length > 0, attention)
      assert.ok(ATTENTION_MANY[attention].length > 0, attention)
    }
  })
})

describe('overviewText', () => {
  test('the head counts the MRs and names the groups that are not empty', () => {
    const lines = overviewText(mixedList()).split('\n')

    assert.equal(
      lines[0],
      '**Мониторинг merge request** - 5: 2 ждут вас, 1 ждут гейта, 1 без данных, ' +
        '1 не ждут, 3 открытых тредов, опрос не удался у 2',
    )
    assert.equal(lines[1], '')
  })

  test('an empty group is left out, and so are zero threads and zero failures', () => {
    const lines = overviewText([
      entryOf(refOf('group/one', 1)),
      entryOf(refOf('group/two', 2), { detailed_merge_status: 'not_approved' }),
    ]).split('\n')

    assert.equal(lines[0], '**Мониторинг merge request** - 2: 2 ждут гейта')
  })

  test('one entry per MR: label, group, reason, title, and the link below it', () => {
    const text = overviewText([
      entryOf(refOf('group/one', 1), {
        title: 'Фикс гонки в очереди',
        detailed_merge_status: 'conflict',
      }),
      blankOf(refOf('group/two', 2), 'нет токена'),
      entryOf(refOf('group/three', 3), {
        title: 'Релиз 1.2',
        state: 'merged',
        detailed_merge_status: 'not_open',
      }),
    ])

    assert.deepEqual(text.split('\n'), [
      '**Мониторинг merge request** - 3: 1 ждут вас, 1 без данных, 1 не ждут, ' +
        'опрос не удался у 1',
      '',
      '- **one!1** (ждёт вас): conflict - Фикс гонки в очереди',
      '  https://gitlab.example.com/group/one/-/merge_requests/1',
      '- **two!2** (данных нет): нет токена',
      '- **three!3** (не ждёт): merged - Релиз 1.2',
      '  https://gitlab.example.com/group/three/-/merge_requests/3',
    ])
  })

  test('nothing watched is said in one line', () => {
    assert.equal(overviewText([]), 'Ни один merge request не отслеживается.')
  })
})
