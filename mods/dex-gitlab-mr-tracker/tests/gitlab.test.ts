// The pure half under test: addresses read off remotes and prompts, GitLab's
// JSON shaped into what the views read, and what one poll announces.
//
//   node --test mods/dex-gitlab-mr-tracker/tests

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  approvalsGiven,
  approvalsOf,
  changesOf,
  commitsOf,
  isOnlyMrUrls,
  labelOf,
  mergeLevel,
  mrDataOf,
  mrPath,
  mrRefsOf,
  oneLine,
  remoteOf,
  threadTally,
  threadsOf,
} from '../hooks/gitlab.ts'

const WEB = 'https://gitlab.example.com/group/sub/proj/-/merge_requests/7'

const noteOf = (over: Record<string, unknown> = {}) => ({
  id: 1,
  body: 'посмотри сюда',
  author: { username: 'alice' },
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
  resolvable: true,
  resolved: false,
  system: false,
  ...over,
})

const dataOf = (over: Record<string, unknown> = {}, discussions: unknown[] = []) =>
  mrDataOf({
    mr: {
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
      upvotes: 1,
      downvotes: 0,
      labels: ['bug'],
      reviewers: [{ username: 'bob' }],
      assignees: [{ username: 'alice' }],
      head_pipeline: { status: 'success', web_url: 'https://gitlab.example.com/p/1' },
      sha: 'aaaa1111',
      updated_at: '2026-09-01T10:00:00Z',
      ...over,
    },
    discussions,
    commits: [{ short_id: 'abc1234', title: 'fix: race', author_name: 'Alice' }],
    approvals: null,
    commitsPageSize: 100,
  })

describe('remoteOf', () => {
  test('reads the scp form git writes for ssh remotes', () => {
    assert.deepEqual(remoteOf('git@gitlab.example.com:group/sub/proj.git'), {
      host: 'gitlab.example.com',
      project: 'group/sub/proj',
    })
  })

  test('reads an ssh URL with a port, dropping the port', () => {
    assert.deepEqual(remoteOf('ssh://git@gitlab.example.com:2222/group/proj.git'), {
      host: 'gitlab.example.com',
      project: 'group/proj',
    })
  })

  test('reads an https URL carrying a user', () => {
    assert.deepEqual(remoteOf('https://ci-user@gitlab.example.com/group/proj'), {
      host: 'gitlab.example.com',
      project: 'group/proj',
    })
  })

  test('a URL that names no project is no remote', () => {
    assert.equal(remoteOf('https://gitlab.example.com'), null)
    assert.equal(remoteOf(''), null)
  })
})

describe('mrRefsOf', () => {
  test('finds every MR once, nested groups included', () => {
    const text = `см. ${WEB} и https://gl.corp/one/two/three/-/merge_requests/42, снова ${WEB}`

    assert.deepEqual(mrRefsOf(text), [
      { host: 'gitlab.example.com', project: 'group/sub/proj', iid: 7 },
      { host: 'gl.corp', project: 'one/two/three', iid: 42 },
    ])
  })

  test('the label is the project tail and the number', () => {
    assert.equal(labelOf({ host: 'h', project: 'group/sub/proj', iid: 7 }), 'proj!7')
  })

  test('the API path escapes the project path', () => {
    assert.equal(
      mrPath({ host: 'h', project: 'group/sub/proj', iid: 7 }),
      'projects/group%2Fsub%2Fproj/merge_requests/7',
    )
  })

  test('a prompt of URLs alone is told from a prompt that mentions one', () => {
    assert.equal(isOnlyMrUrls(` ${WEB} \n${WEB}`), true)
    assert.equal(isOnlyMrUrls(`почини ${WEB}`), false)
  })
})

describe('threadsOf', () => {
  test('a standalone comment is not a thread', () => {
    const threads = threadsOf(
      [{ id: 'd1', individual_note: true, notes: [noteOf()] }],
      WEB,
    )

    assert.deepEqual(threads, [])
  })

  test('system notes are events, not comments', () => {
    const threads = threadsOf(
      [
        {
          id: 'd1',
          individual_note: false,
          notes: [noteOf(), noteOf({ id: 2, system: true, body: 'changed title' })],
        },
      ],
      WEB,
    )

    assert.equal(threads[0]?.notes, 1)
  })

  test('a thread is resolved once every resolvable note is', () => {
    const [open, closed] = threadsOf(
      [
        {
          id: 'd1',
          individual_note: false,
          notes: [noteOf(), noteOf({ id: 2, resolved: true })],
        },
        {
          id: 'd2',
          individual_note: false,
          notes: [noteOf({ id: 3, resolved: true, author: { username: 'bob' } })],
        },
      ],
      WEB,
    )

    assert.equal(open?.resolved, false)
    assert.equal(closed?.resolved, true)
    assert.equal(closed?.author, 'bob')
  })

  test('a diff thread carries its file, its line and a link to the note', () => {
    const [thread] = threadsOf(
      [
        {
          id: 'd1',
          individual_note: false,
          notes: [noteOf({ id: 99, position: { new_path: 'src/queue.ts', new_line: 42 } })],
        },
      ],
      WEB,
    )

    assert.equal(thread?.file, 'src/queue.ts')
    assert.equal(thread?.line, 42)
    assert.equal(thread?.url, `${WEB}#note_99`)
  })

  test('a thread nobody can resolve is counted apart', () => {
    const data = dataOf({}, [
      { id: 'd1', individual_note: false, notes: [noteOf({ resolvable: false })] },
      { id: 'd2', individual_note: false, notes: [noteOf({ id: 2 })] },
    ])

    assert.deepEqual(threadTally(data.threads), { open: 1, resolvable: 1, total: 2 })
  })
})

describe('mrDataOf', () => {
  test('draft is read from either spelling GitLab uses', () => {
    assert.equal(dataOf({ draft: false, work_in_progress: true }).draft, true)
  })

  test('the pipeline falls back to the deprecated field', () => {
    const data = dataOf({ head_pipeline: undefined, pipeline: { status: 'running' } })

    assert.equal(data.pipeline?.status, 'running')
  })

  test('a merge status the instance spells the old way still reads', () => {
    const data = dataOf({ detailed_merge_status: undefined, merge_status: 'can_be_merged' })

    assert.equal(data.mergeStatus, 'can_be_merged')
  })

  test('a full page of commits is a floor, not a total', () => {
    const many = Array.from({ length: 4 }, (_, index) => ({
      short_id: `c${index}`,
      title: 't',
      author_name: 'a',
    }))

    const data = mrDataOf({
      mr: { iid: 1, web_url: WEB },
      discussions: [],
      commits: many,
      approvals: null,
      commitsPageSize: 4,
    })

    assert.equal(data.commitsCapped, true)
  })

  test('approvals are absent, not zero, where the instance has no endpoint', () => {
    assert.equal(approvalsOf(null), null)
    assert.deepEqual(
      approvalsOf({
        approvals_required: 2,
        approvals_left: 1,
        approved_by: [{ user: { username: 'bob' } }],
      }),
      { required: 2, left: 1, by: ['bob'] },
    )
  })

  test('a free instance names the approvers but no rule, and the quota stays null', () => {
    // The shape git.dextechnology.com answers on the free tier (probe 15.09.2026):
    // approval rules are paid, `approved_by` is not.
    const approvals = approvalsOf({
      user_has_approved: false,
      user_can_approve: true,
      approved: true,
      approved_by: [{ user: { username: 'bob' } }],
    })

    assert.deepEqual(approvals, { required: null, left: null, by: ['bob'] })
    assert.equal(approvals === null ? -1 : approvalsGiven(approvals), 1)
  })

  test('commit titles lose control characters', () => {
    assert.equal(commitsOf([{ short_id: 'a', title: 'fix\u0007 bell', author_name: 'a' }])[0]?.title, 'fix bell')
    assert.equal(oneLine('первая\nвторая'), 'первая вторая')
  })
})

describe('mergeLevel', () => {
  // Перечень значений - docs.gitlab.com/api/merge_requests, "Merge status",
  // сверено 15.09.2026.
  test('смержить можно сейчас - только mergeable и устаревшее can_be_merged', () => {
    assert.equal(mergeLevel('mergeable'), 'good')
    assert.equal(mergeLevel('can_be_merged'), 'good')
  })

  test('требуют вмешательства в MR или ветку', () => {
    for (const status of [
      'conflict',
      'need_rebase',
      'commits_status',
      'requested_changes',
      'merge_request_blocked',
      'security_policy_violations',
      'locked_paths',
      'locked_lfs_files',
    ]) {
      assert.equal(mergeLevel(status), 'bad', status)
    }
  })

  test('делать нечего: MR не открыт, черновик или ждёт назначенного времени', () => {
    for (const status of ['draft_status', 'not_open', 'merge_time']) {
      assert.equal(mergeLevel(status), 'idle', status)
    }
  })

  test('штатный гейт ещё не пройден', () => {
    for (const status of [
      'approvals_syncing',
      'checking',
      'unchecked',
      'preparing',
      'ci_must_pass',
      'ci_still_running',
      'discussions_not_resolved',
      'not_approved',
      'status_checks_must_pass',
      'security_policy_pipeline_check',
      'jira_association_missing',
      'title_regex',
    ]) {
      assert.equal(mergeLevel(status), 'wait', status)
    }
  })

  test('значение, которого набор не знает, ждёт, а не падает', () => {
    assert.equal(mergeLevel('something_gitlab_added_later'), 'wait')
    assert.equal(mergeLevel(''), 'wait')
  })
})

describe('changesOf', () => {
  const base = dataOf({}, [{ id: 'd1', individual_note: false, notes: [noteOf()] }])

  test('the first poll of an MR announces nothing', () => {
    assert.deepEqual(changesOf(undefined, base), [])
  })

  test('a new thread is announced with its place and its first line', () => {
    const next = dataOf({}, [
      { id: 'd1', individual_note: false, notes: [noteOf()] },
      {
        id: 'd2',
        individual_note: false,
        notes: [noteOf({ id: 5, position: { new_path: 'a.ts', new_line: 3 } })],
      },
    ])

    const change = changesOf(base, next).find(entry => entry.kind === 'thread')

    assert.match(change?.text ?? '', /новый тред от alice \(a\.ts:3\)/)
    assert.equal(change?.level, 'bad')
  })

  test('a resolved thread reads as good news', () => {
    const next = dataOf({}, [
      { id: 'd1', individual_note: false, notes: [noteOf({ resolved: true })] },
    ])

    const change = changesOf(base, next).find(entry => entry.kind === 'thread')

    assert.match(change?.text ?? '', /тред закрыт/)
    assert.equal(change?.level, 'good')
  })

  test('another comment in a known thread is its own line', () => {
    const next = dataOf({}, [
      {
        id: 'd1',
        individual_note: false,
        notes: [noteOf(), noteOf({ id: 2, author: { username: 'bob' } })],
      },
    ])

    const change = changesOf(base, next).find(entry => entry.kind === 'comment')

    assert.match(change?.text ?? '', /\+1 комментарий .* \(bob\)/)
  })

  test('state, merge status and pipeline each announce their move', () => {
    const next = dataOf(
      {
        state: 'merged',
        detailed_merge_status: 'conflict',
        head_pipeline: { status: 'failed', web_url: '' },
      },
      [{ id: 'd1', individual_note: false, notes: [noteOf()] }],
    )

    const kinds = changesOf(base, next).map(change => change.kind)

    assert.ok(kinds.includes('state'))
    assert.ok(kinds.includes('merge'))
    assert.ok(kinds.includes('pipeline'))
  })

  test('a moved head announces the commits it added, a rewrite as a rewrite', () => {
    const grown = mrDataOf({
      mr: { iid: 7, web_url: WEB, sha: 'bbbb2222' },
      discussions: [],
      commits: [{ short_id: 'a' }, { short_id: 'b' }],
      approvals: null,
      commitsPageSize: 100,
    })

    const forced = mrDataOf({
      mr: { iid: 7, web_url: WEB, sha: 'cccc3333' },
      discussions: [],
      commits: [{ short_id: 'z' }],
      approvals: null,
      commitsPageSize: 100,
    })

    assert.match(
      changesOf(base, grown).find(change => change.kind === 'commit')?.text ?? '',
      /\+1 коммит/,
    )
    assert.match(
      changesOf(grown, forced).find(change => change.kind === 'commit')?.text ?? '',
      /force push/,
    )
  })

  test('approvals announce the count that is now given', () => {
    const before = mrDataOf({
      mr: { iid: 7, web_url: WEB },
      discussions: [],
      commits: [],
      approvals: { approvals_required: 2, approvals_left: 2, approved_by: [] },
      commitsPageSize: 100,
    })

    const after = mrDataOf({
      mr: { iid: 7, web_url: WEB },
      discussions: [],
      commits: [],
      approvals: {
        approvals_required: 2,
        approvals_left: 0,
        approved_by: [{ user: { username: 'bob' } }, { user: { username: 'carl' } }],
      },
      commitsPageSize: 100,
    })

    const change = changesOf(before, after).find(entry => entry.kind === 'approval')

    assert.match(change?.text ?? '', /апрувы: 2\/2/)
    assert.equal(change?.level, 'good')
  })
})
