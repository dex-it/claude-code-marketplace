// The pure half under test: addresses read off remotes and prompts, GitHub's
// GraphQL answer shaped into what the views read, and what one poll announces.
//
//   node --test mods/dex-github-pr-tracker/tests

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  changesOf,
  checkLevel,
  checksOf,
  commitsOf,
  decisionWord,
  isOnlyPrUrls,
  mergeLevel,
  oneLine,
  prDataOf,
  prRefsOf,
  remoteOf,
  repoRefOf,
  reviewsOf,
  shortenPath,
  threadTally,
  threadsOf,
  threadsOfPages,
} from '../hooks/github.ts'
import type { PrData, Thread } from '../hooks/github.ts'

const URL_7 = 'https://github.com/dex-it/marketplace/pull/7'

const commentOf = (over: Record<string, unknown> = {}) => ({
  author: { login: 'reviewer' },
  body: 'Здесь гонка',
  url: `${URL_7}#discussion_r1`,
  createdAt: '2026-09-20T10:00:00Z',
  ...over,
})

const threadNodeOf = (over: Record<string, unknown> = {}) => ({
  id: 'PRRT_1',
  isResolved: false,
  isOutdated: false,
  path: 'src/queue.ts',
  line: 42,
  originalLine: 40,
  comments: { totalCount: 1, nodes: [commentOf()] },
  tail: { nodes: [commentOf({ author: { login: 'author' }, createdAt: '2026-09-20T11:00:00Z' })] },
  ...over,
})

const runOf = (over: Record<string, unknown> = {}) => ({
  __typename: 'CheckRun',
  name: 'build',
  status: 'COMPLETED',
  conclusion: 'SUCCESS',
  detailsUrl: 'https://github.com/dex-it/marketplace/actions/runs/1',
  isRequired: true,
  ...over,
})

const headOf = (contexts: unknown[], state = 'SUCCESS') => ({
  nodes: [
    {
      commit: {
        oid: 'abcdef1234567890',
        statusCheckRollup: { state, contexts: { nodes: contexts } },
      },
    },
  ],
})

const prNodeOf = (over: Record<string, unknown> = {}) => ({
  number: 7,
  title: 'Фикс гонки в очереди',
  state: 'OPEN',
  isDraft: false,
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'BLOCKED',
  reviewDecision: 'REVIEW_REQUIRED',
  additions: 322,
  deletions: 109,
  changedFiles: 18,
  url: URL_7,
  updatedAt: '2026-09-20T12:00:00Z',
  headRefName: 'fix/queue',
  baseRefName: 'develop',
  author: { login: 'yaryrslv' },
  labels: { nodes: [{ name: 'bug' }] },
  assignees: { nodes: [{ login: 'yaryrslv' }] },
  reviewRequests: { nodes: [{ requestedReviewer: { __typename: 'User', login: 'mmx003' } }] },
  latestReviews: { nodes: [{ state: 'APPROVED', author: { login: 'mmx003' } }] },
  comments: { totalCount: 3 },
  commits: {
    totalCount: 12,
    nodes: [
      {
        commit: {
          oid: 'aaaaaaa1',
          abbreviatedOid: 'aaaaaaa',
          messageHeadline: 'Первый',
          author: { name: 'Я', user: { login: 'yaryrslv' } },
        },
      },
    ],
  },
  head: headOf([runOf()]),
  reviewThreads: {
    totalCount: 1,
    pageInfo: { hasNextPage: false, endCursor: null },
    nodes: [threadNodeOf()],
  },
  ...over,
})

const dataOf = (over: Record<string, unknown> = {}): PrData => {
  const pr = prNodeOf(over)

  return prDataOf({ pr, threads: threadsOf(pr.reviewThreads) })
}

describe('remoteOf', () => {
  test('the scp form git writes for ssh remotes', () => {
    assert.deepEqual(remoteOf('git@github.com:dex-it/marketplace.git'), {
      host: 'github.com',
      owner: 'dex-it',
      repo: 'marketplace',
    })
  })

  test('https with a user, a port and a trailing slash', () => {
    assert.deepEqual(remoteOf('https://bot@gh.corp.example:8443/team/app.git/'), {
      host: 'gh.corp.example',
      owner: 'team',
      repo: 'app',
    })
  })

  test('ssh:// with a port', () => {
    assert.deepEqual(remoteOf('ssh://git@gh.corp:22/team/app'), {
      host: 'gh.corp',
      owner: 'team',
      repo: 'app',
    })
  })

  test('a path that is not owner/repo is refused instead of guessed', () => {
    // Вложенных групп у GitHub нет: три сегмента - чужой адрес, не подгруппа.
    assert.equal(remoteOf('https://gh.corp/group/sub/app.git'), null)
    assert.equal(remoteOf('git@github.com:dex-it.git'), null)
    assert.equal(remoteOf(''), null)
    assert.equal(remoteOf('not a url'), null)
  })
})

describe('repoRefOf', () => {
  test('owner and repo, with the host that is known', () => {
    assert.deepEqual(repoRefOf('dex-it/marketplace', 'github.com'), {
      host: 'github.com',
      owner: 'dex-it',
      repo: 'marketplace',
    })
    assert.deepEqual(repoRefOf('  dex-it/marketplace  ', 'github.com'), {
      host: 'github.com',
      owner: 'dex-it',
      repo: 'marketplace',
    })
  })

  test('a host in front of the path is taken as the host', () => {
    assert.deepEqual(repoRefOf('gh.corp/team/app', 'github.com'), {
      host: 'gh.corp',
      owner: 'team',
      repo: 'app',
    })
  })

  test('a link to the repository or to a pull request names the same repository', () => {
    const expected = { host: 'github.com', owner: 'dex-it', repo: 'marketplace' }

    assert.deepEqual(repoRefOf('https://github.com/dex-it/marketplace', 'gh.corp'), expected)
    assert.deepEqual(repoRefOf('https://github.com/dex-it/marketplace/pull/244', 'gh.corp'), expected)
    assert.deepEqual(repoRefOf('git@github.com:dex-it/marketplace.git', 'gh.corp'), expected)
  })

  test('an owner with a dot is an owner: the path is exactly two segments', () => {
    // Иначе `my.org/repo` прочиталось бы хостом с одним сегментом пути.
    assert.deepEqual(repoRefOf('my.org/repo', 'github.com'), {
      host: 'github.com',
      owner: 'my.org',
      repo: 'repo',
    })
  })

  test('what is not an address is refused instead of guessed', () => {
    assert.equal(repoRefOf('repo', 'github.com'), null)
    assert.equal(repoRefOf('', 'github.com'), null)
    assert.equal(repoRefOf('a/b/c/d', 'github.com'), null)
    // Хост неизвестен и в тексте его нет: угадывать нечего.
    assert.equal(repoRefOf('dex-it/marketplace', ''), null)
  })
})

describe('prRefsOf', () => {
  test('every pull request named in a text, each once, in order', () => {
    const text = `см. ${URL_7} и https://gh.corp/team/app/pull/9, а также ${URL_7}`

    assert.deepEqual(prRefsOf(text), [
      { host: 'github.com', owner: 'dex-it', repo: 'marketplace', number: 7 },
      { host: 'gh.corp', owner: 'team', repo: 'app', number: 9 },
    ])
  })

  test('a link to a file view or to one comment names the same pull request', () => {
    assert.deepEqual(prRefsOf(`${URL_7}/files#diff-abc`), [
      { host: 'github.com', owner: 'dex-it', repo: 'marketplace', number: 7 },
    ])
    assert.deepEqual(prRefsOf(`${URL_7}#discussion_r4059577902`), [
      { host: 'github.com', owner: 'dex-it', repo: 'marketplace', number: 7 },
    ])
  })

  test('an issue is not a pull request', () => {
    assert.deepEqual(prRefsOf('https://github.com/dex-it/marketplace/issues/7'), [])
  })

  test('a prompt of nothing but pull request links toggles them', () => {
    assert.equal(isOnlyPrUrls(`  ${URL_7}  `), true)
    assert.equal(isOnlyPrUrls(`${URL_7} https://gh.corp/team/app/pull/9`), true)
    assert.equal(isOnlyPrUrls(`посмотри ${URL_7}`), false)
  })
})

describe('threadsOf', () => {
  test('a thread carries its address, its first comment and its last author', () => {
    const [thread] = threadsOf({ nodes: [threadNodeOf()] })

    assert.deepEqual(thread, {
      id: 'PRRT_1',
      resolved: false,
      outdated: false,
      notes: 1,
      author: 'reviewer',
      file: 'src/queue.ts',
      line: 42,
      body: 'Здесь гонка',
      lastAuthor: 'author',
      lastAt: '2026-09-20T11:00:00Z',
      url: `${URL_7}#discussion_r1`,
    })
  })

  test('an outdated thread keeps the line it was written against', () => {
    // GitHub отдаёт `line: null`, когда строка уехала в новых коммитах, и
    // адрес треда живёт только в `originalLine`.
    const [thread] = threadsOf({
      nodes: [threadNodeOf({ isOutdated: true, line: null })],
    })

    assert.equal(thread?.outdated, true)
    assert.equal(thread?.line, 40)
  })

  test('a thread on the file as a whole has no line at all', () => {
    const [thread] = threadsOf({
      nodes: [threadNodeOf({ line: null, originalLine: null })],
    })

    assert.equal(thread?.line, null)
    assert.equal(thread?.file, 'src/queue.ts')
  })

  test('the resolved flag is GitHub own, not folded up from comments', () => {
    const [thread] = threadsOf({ nodes: [threadNodeOf({ isResolved: true })] })

    assert.equal(thread?.resolved, true)
  })

  test('a thread without a single comment is not drawn at all', () => {
    assert.deepEqual(
      threadsOf({ nodes: [threadNodeOf({ comments: { totalCount: 0, nodes: [] } })] }),
      [],
    )
  })

  test('control characters of a foreign comment do not reach the terminal', () => {
    const [thread] = threadsOf({
      nodes: [
        threadNodeOf({
          comments: {
            totalCount: 1,
            nodes: [commentOf({ body: 'строка\u001b[31m и\nвторая' })],
          },
        }),
      ],
    })

    assert.equal(thread?.body, 'строка [31m и вторая')
  })

  test('nothing at all reads as no threads', () => {
    assert.deepEqual(threadsOf(undefined), [])
    assert.deepEqual(threadsOf({ nodes: null }), [])
  })
})

describe('mergeLevel', () => {
  // Весь перечень enum `MergeStateStatus` из схемы GraphQL
  // (docs.github.com/graphql/reference/pulls, сверено 25.09.2026).
  test('mergeable now', () => {
    assert.equal(mergeLevel('CLEAN'), 'good')
    assert.equal(mergeLevel('HAS_HOOKS'), 'good')
  })

  test('needs work on the branch', () => {
    assert.equal(mergeLevel('DIRTY'), 'bad')
    assert.equal(mergeLevel('BEHIND'), 'bad')
  })

  test('nothing to do', () => {
    assert.equal(mergeLevel('DRAFT'), 'idle')
  })

  test('a gate has not been passed yet', () => {
    assert.equal(mergeLevel('BLOCKED'), 'wait')
    assert.equal(mergeLevel('UNSTABLE'), 'wait')
    assert.equal(mergeLevel('UNKNOWN'), 'wait')
  })

  test('a value the schema does not have yet is drawn, not hidden', () => {
    assert.equal(mergeLevel('MERGE_QUEUED'), 'wait')
    assert.equal(mergeLevel(''), 'wait')
  })
})

describe('checkLevel', () => {
  // Перечень `CheckConclusionState` и `StatusState`, те же источники.
  test('green outcomes', () => {
    assert.equal(checkLevel('SUCCESS'), 'ok')
    assert.equal(checkLevel('NEUTRAL'), 'ok')
    assert.equal(checkLevel('SKIPPED'), 'ok')
  })

  test('red outcomes', () => {
    for (const word of [
      'FAILURE',
      'TIMED_OUT',
      'CANCELLED',
      'ACTION_REQUIRED',
      'STARTUP_FAILURE',
      'ERROR',
    ]) {
      assert.equal(checkLevel(word), 'bad', word)
    }
  })

  test('anything that has not said an outcome is waited for', () => {
    for (const word of ['PENDING', 'QUEUED', 'IN_PROGRESS', 'EXPECTED', 'WAITING', 'STALE', '']) {
      assert.equal(checkLevel(word), 'wait', word)
    }
  })
})

describe('checksOf', () => {
  test('no rollup at all is no checks, not a green light', () => {
    assert.equal(checksOf({ nodes: [{ commit: { oid: 'a' } }] }), null)
    assert.equal(checksOf(undefined), null)
  })

  test('the verdict counts required checks only', () => {
    // Роллап красный из-за необязательной джобы, а мержу она не мешает.
    const checks = checksOf(
      headOf(
        [
          runOf({ name: 'required', isRequired: true, conclusion: 'SUCCESS' }),
          runOf({ name: 'optional', isRequired: false, conclusion: 'FAILURE' }),
        ],
        'FAILURE',
      ),
    )

    assert.equal(checks?.level, 'ok')
    assert.equal(checks?.word, 'success')
    assert.equal(checks?.state, 'FAILURE')
    assert.equal(checks?.required, 1)
    assert.deepEqual(
      checks?.bad.map(check => [check.name, check.required]),
      [['optional', false]],
    )
  })

  test('a failed required check beats a pending one', () => {
    const checks = checksOf(
      headOf([
        runOf({ name: 'slow', status: 'IN_PROGRESS', conclusion: null }),
        runOf({ name: 'tests', conclusion: 'FAILURE' }),
      ]),
    )

    assert.equal(checks?.level, 'bad')
    assert.equal(checks?.word, 'failure')
    assert.equal(checks?.bad.length, 2)
  })

  test('a run that has not completed is waited for, not read as failed', () => {
    const checks = checksOf(
      headOf([runOf({ status: 'QUEUED', conclusion: null })]),
    )

    assert.equal(checks?.level, 'wait')
    assert.equal(checks?.word, 'pending')
  })

  test('with no required checks the rollup is the only word there is', () => {
    const checks = checksOf(
      headOf([runOf({ isRequired: false, conclusion: 'FAILURE' })], 'FAILURE'),
    )

    assert.equal(checks?.required, 0)
    assert.equal(checks?.level, 'bad')
    assert.equal(checks?.word, 'failure')
  })

  test('a commit status is read beside a check run', () => {
    const checks = checksOf(
      headOf(
        [
          { __typename: 'StatusContext', context: 'ci/jenkins', state: 'FAILURE', targetUrl: 'u', isRequired: true },
        ],
        'FAILURE',
      ),
    )

    assert.equal(checks?.level, 'bad')
    assert.deepEqual(
      checks?.bad.map(check => [check.name, check.word, check.url]),
      [['ci/jenkins', 'failure', 'u']],
    )
  })
})

describe('reviewsOf', () => {
  test('approvals and change requests come from the latest review of each person', () => {
    const reviews = reviewsOf(
      {
        nodes: [
          { state: 'APPROVED', author: { login: 'one' } },
          { state: 'CHANGES_REQUESTED', author: { login: 'two' } },
          { state: 'COMMENTED', author: { login: 'three' } },
          { state: 'APPROVED', author: null },
        ],
      },
      'CHANGES_REQUESTED',
    )

    assert.deepEqual(reviews, {
      decision: 'CHANGES_REQUESTED',
      approved: ['one'],
      changesRequested: ['two'],
    })
  })

  test('a repository that requires no review answers no decision', () => {
    assert.deepEqual(reviewsOf({ nodes: [] }, null), {
      decision: null,
      approved: [],
      changesRequested: [],
    })
  })
})

describe('decisionWord', () => {
  test('every value of the enum has a word, and the absent one has none', () => {
    assert.equal(decisionWord('APPROVED'), 'одобрен')
    assert.equal(decisionWord('CHANGES_REQUESTED'), 'нужны правки')
    assert.equal(decisionWord('REVIEW_REQUIRED'), 'ждёт ревью')
    assert.equal(decisionWord(null), null)
  })
})

describe('prDataOf', () => {
  test('the answer folds into the facts the views read', () => {
    const data = dataOf()

    assert.equal(data.number, 7)
    assert.equal(data.state, 'OPEN')
    assert.equal(data.draft, false)
    assert.equal(data.author, 'yaryrslv')
    assert.equal(data.mergeStatus, 'BLOCKED')
    assert.equal(data.mergeable, 'MERGEABLE')
    assert.equal(data.changedFiles, 18)
    assert.equal(data.comments, 3)
    assert.deepEqual(data.labels, ['bug'])
    assert.deepEqual(data.reviewers, ['mmx003'])
    assert.deepEqual(data.assignees, ['yaryrslv'])
    assert.equal(data.threads.length, 1)
    assert.equal(data.reviews.decision, 'REVIEW_REQUIRED')
    assert.deepEqual(data.reviews.approved, ['mmx003'])
  })

  test('the commit count is the branch total, not the page drawn', () => {
    const data = dataOf()

    assert.equal(data.commitsTotal, 12)
    assert.equal(data.commits.length, 1)
  })

  test('the head sha comes from the commit the checks ran on', () => {
    assert.equal(dataOf().headSha, 'abcdef1234567890')
  })

  test('a reviewer that is a team is named by its name', () => {
    const data = dataOf({
      reviewRequests: { nodes: [{ requestedReviewer: { __typename: 'Team', name: 'platform' } }] },
    })

    assert.deepEqual(data.reviewers, ['platform'])
  })

  test('a title with control characters is cleaned before it is drawn', () => {
    assert.equal(dataOf({ title: 'Фикс\u0007 гонки' }).title, 'Фикс  гонки')
  })

  test('an empty answer reads as unknown, not as a crash', () => {
    const data = prDataOf({ pr: {}, threads: [] })

    assert.equal(data.state, 'UNKNOWN')
    assert.equal(data.mergeStatus, 'UNKNOWN')
    assert.equal(data.checks, null)
    assert.equal(data.commitsTotal, 0)
  })
})

describe('commitsOf', () => {
  test('the author is the GitHub login where there is one, the git name otherwise', () => {
    assert.deepEqual(
      commitsOf({
        nodes: [
          { commit: { oid: 'aaaaaaabbbb', messageHeadline: 'Раз', author: { name: 'Я' } } },
          {
            commit: {
              abbreviatedOid: 'bbbbbbb',
              messageHeadline: 'Два',
              author: { name: 'Я', user: { login: 'yaryrslv' } },
            },
          },
        ],
      }),
      [
        { sha: 'aaaaaaa', title: 'Раз', author: 'Я' },
        { sha: 'bbbbbbb', title: 'Два', author: 'yaryrslv' },
      ],
    )
  })
})

describe('oneLine and shortenPath', () => {
  test('a comment becomes one line, cut to the width asked', () => {
    assert.equal(oneLine('первая\n\nвторая   третья'), 'первая вторая третья')
    assert.equal(oneLine('abcdefghij', 8), 'abcde...')
  })

  test('the head of the path goes, the file name and the line stay', () => {
    assert.equal(shortenPath('a/b/c.ts:12', 40), 'a/b/c.ts:12')
    assert.equal(shortenPath('src/eye/command/CreateData.cs:54', 24), '.../CreateData.cs:54')
    assert.equal(shortenPath('src/eye/command/CreateData.cs:54', 12), '...ata.cs:54')
  })
})

describe('threadTally and threadsOfPages', () => {
  test('open over all of them: every review thread can be resolved', () => {
    const threads: readonly Thread[] = threadsOf({
      nodes: [
        threadNodeOf({ id: 'a' }),
        threadNodeOf({ id: 'b', isResolved: true }),
        threadNodeOf({ id: 'c' }),
      ],
    })

    assert.deepEqual(threadTally(threads), { open: 2, total: 3 })
  })

  test('the pages of one poll read as one list, in the order they came', () => {
    assert.deepEqual(
      threadsOfPages([
        { nodes: [threadNodeOf({ id: 'a' })] },
        { nodes: [threadNodeOf({ id: 'b' })] },
      ]).map(thread => thread.id),
      ['a', 'b'],
    )
  })
})

describe('changesOf', () => {
  test('the first load of a pull request announces nothing', () => {
    assert.deepEqual(changesOf(undefined, dataOf()), [])
  })

  test('an unmoved pull request announces nothing', () => {
    assert.deepEqual(changesOf(dataOf(), dataOf()), [])
  })

  test('state, draft and merge status each announce their move', () => {
    const merged = changesOf(dataOf(), dataOf({ state: 'MERGED' }))

    assert.deepEqual(merged.map(change => [change.kind, change.level]), [['state', 'good']])

    const draft = changesOf(dataOf(), dataOf({ isDraft: true }))

    assert.equal(draft[0]?.kind, 'state')
    assert.equal(draft[0]?.text, 'переведён в draft')

    const clean = changesOf(dataOf(), dataOf({ mergeStateStatus: 'CLEAN' }))

    assert.deepEqual(clean.map(change => [change.kind, change.level]), [['merge', 'good']])
  })

  test('the checks announced are the required ones', () => {
    const before = dataOf()
    const after = dataOf({
      head: headOf([runOf({ conclusion: 'FAILURE' })], 'FAILURE'),
    })
    const changes = changesOf(before, after)

    assert.deepEqual(changes.map(change => [change.kind, change.level]), [['checks', 'bad']])
    assert.equal(changes[0]?.text, 'проверки: success -> failure')
  })

  test('a red optional check is not announced: it blocks nothing', () => {
    const before = dataOf()
    const after = dataOf({
      head: headOf(
        [runOf(), runOf({ name: 'optional', isRequired: false, conclusion: 'FAILURE' })],
        'FAILURE',
      ),
    })

    assert.deepEqual(changesOf(before, after), [])
  })

  test('a new thread names the file, the line, the author and the remark', () => {
    const after = dataOf({
      reviewThreads: {
        totalCount: 2,
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [threadNodeOf(), threadNodeOf({ id: 'PRRT_2', line: 7 })],
      },
    })
    const changes = changesOf(dataOf(), after)

    assert.deepEqual(changes.map(change => change.kind), ['thread'])
    assert.equal(
      changes[0]?.text,
      'новый тред от reviewer (src/queue.ts:7): Здесь гонка',
    )
  })

  test('a thread closed, reopened, answered and deleted each announce once', () => {
    const open = dataOf()
    const closed = dataOf({
      reviewThreads: {
        totalCount: 1,
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [threadNodeOf({ isResolved: true })],
      },
    })

    assert.deepEqual(changesOf(open, closed).map(change => [change.kind, change.level]), [
      ['thread', 'good'],
    ])
    assert.deepEqual(changesOf(closed, open).map(change => [change.kind, change.level]), [
      ['thread', 'bad'],
    ])

    const answered = dataOf({
      reviewThreads: {
        totalCount: 1,
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [threadNodeOf({ comments: { totalCount: 3, nodes: [commentOf()] } })],
      },
    })

    assert.equal(changesOf(open, answered)[0]?.kind, 'comment')
    assert.equal(
      changesOf(open, answered)[0]?.text,
      '+2 комментарий в треде src/queue.ts:42 (author)',
    )

    const gone = dataOf({
      reviewThreads: { totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
    })

    assert.equal(changesOf(open, gone)[0]?.text, 'удалено тредов: 1')
  })

  test('a comment in the pull request conversation is its own corpus', () => {
    const changes = changesOf(dataOf(), dataOf({ comments: { totalCount: 5 } }))

    assert.deepEqual(changes.map(change => change.kind), ['comment'])
    assert.equal(changes[0]?.text, '+2 комментарий в обсуждении PR')
  })

  test('a moved head announces the commits it added, a rewrite as a rewrite', () => {
    const before = dataOf()
    const pushed = dataOf({
      commits: { totalCount: 14, nodes: prNodeOf().commits.nodes },
      head: headOf([runOf()], 'SUCCESS'),
    })

    // Тот же oid головного коммита: сдвига нет.
    assert.deepEqual(changesOf(before, pushed), [])

    const moved = dataOf({
      commits: { totalCount: 14, nodes: prNodeOf().commits.nodes },
      head: {
        nodes: [
          {
            commit: {
              oid: 'ffffffff',
              statusCheckRollup: { state: 'SUCCESS', contexts: { nodes: [runOf()] } },
            },
          },
        ],
      },
    })

    assert.equal(changesOf(before, moved)[0]?.text, '+2 коммит в ветке')

    const rewritten = dataOf({
      commits: { totalCount: 10, nodes: prNodeOf().commits.nodes },
      head: {
        nodes: [
          {
            commit: {
              oid: 'ffffffff',
              statusCheckRollup: { state: 'SUCCESS', contexts: { nodes: [runOf()] } },
            },
          },
        ],
      },
    })

    assert.equal(changesOf(before, rewritten)[0]?.text, 'ветка переписана (force push)')
  })

  test('the review verdict is announced, and its count only while it holds', () => {
    const approved = changesOf(dataOf(), dataOf({ reviewDecision: 'APPROVED' }))

    assert.deepEqual(approved.map(change => [change.kind, change.level]), [['review', 'good']])
    assert.equal(approved[0]?.text, 'ревью: одобрен')

    const more = changesOf(
      dataOf(),
      dataOf({
        latestReviews: {
          nodes: [
            { state: 'APPROVED', author: { login: 'mmx003' } },
            { state: 'APPROVED', author: { login: 'other' } },
          ],
        },
      }),
    )

    assert.equal(more[0]?.text, 'апрувы: 2 (было 1)')
  })
})
