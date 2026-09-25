// What GitHub says, read as plain data: the remote's host and repository, pull
// request references in text, the GraphQL answer shaped into what the mod
// draws, and what moved between two polls. Nothing here touches `$` - it is
// the half that tests run on their own.

export type Remote = { host: string; owner: string; repo: string }

/** One pull request, addressed the way every call and every key spells it. */
export type PrRef = { host: string; owner: string; repo: string; number: number }

export type Thread = {
  id: string
  /**
   * GitHub resolves the thread itself: `isResolved` is a field of the thread,
   * not a state folded up from its comments. Every review thread can be
   * resolved, so there is no second class of them the way GitLab has.
   */
  resolved: boolean
  /** Newer commits moved the code the thread sits on; `line` is then null. */
  outdated: boolean
  /** Comments in the thread. */
  notes: number
  author: string
  /** The file the thread sits on; null only where GitHub named none. */
  file: string | null
  line: number | null
  /** The first comment, one line. */
  body: string
  lastAuthor: string
  lastAt: string
  url: string
}

export type Commit = { sha: string; title: string; author: string }

/**
 * One check of the head commit, its state folded into three outcomes. Two
 * corpora answer here - the Checks API (a CI app writes check runs) and the
 * Statuses API (an older integration writes commit statuses) - and GitHub
 * itself shows them as one list, so the mod reads them as one too.
 */
export type Check = {
  name: string
  level: CheckLevel
  word: string
  url: string
  /**
   * Проверка названа обязательной правилами защиты ветки для этого PR
   * (`isRequired(pullRequestNumber:)`). Необязательная краснеет, ничего не
   * блокируя, и именно из-за неё роллап бывает красным у мержабельного PR.
   */
  required: boolean
}

export type CheckLevel = 'ok' | 'bad' | 'wait'

/**
 * Null where the head commit has no checks at all.
 *
 * Здесь два суждения, и они расходятся намеренно. `state` - роллап самого
 * GitHub по всем проверкам, тот же, что виден на странице PR. `level` и
 * `word` - исход только обязательных, потому что строка над вводом отвечает
 * на вопрос «мешает ли что-то мержу»; обязательных нет вовсе - берётся
 * роллап, других сведений тогда и нет.
 */
export type Checks = {
  level: CheckLevel
  /** `success`, `failure`, `pending` либо роллап как есть, в нижнем регистре. */
  word: string
  state: string
  total: number
  /** Обязательных проверок; 0 - правила защиты ветки их не требуют. */
  required: number
  /** Не зелёные - и обязательные, и нет; `required` каждой названо в ней. */
  bad: readonly Check[]
} | null

/**
 * What code review says. `decision` is GitHub's own verdict and is null where
 * the repository requires no review at all; `approved` and `changesRequested`
 * name the people behind it, counted from the latest review of each person.
 */
export type Reviews = {
  decision: string | null
  approved: readonly string[]
  changesRequested: readonly string[]
}

export type PrData = {
  number: number
  title: string
  /** `OPEN`, `CLOSED`, `MERGED`. */
  state: string
  draft: boolean
  author: string
  headRefName: string
  baseRefName: string
  webUrl: string
  /** `MergeStateStatus`: the detailed merge state, as GitHub spells it. */
  mergeStatus: string
  /** `MERGEABLE`, `CONFLICTING`, `UNKNOWN` - computed after a push, not with it. */
  mergeable: string
  additions: number
  deletions: number
  changedFiles: number
  /** Comments in the pull request conversation; thread comments are counted per thread. */
  comments: number
  labels: readonly string[]
  reviewers: readonly string[]
  assignees: readonly string[]
  checks: Checks
  headSha: string
  updatedAt: string
  threads: readonly Thread[]
  commits: readonly Commit[]
  /** Every commit of the branch, not only the page the mod drew. */
  commitsTotal: number
  reviews: Reviews
}

export type ChangeKind =
  | 'state'
  | 'merge'
  | 'checks'
  | 'thread'
  | 'comment'
  | 'commit'
  | 'review'

export type Change = { kind: ChangeKind; text: string; level: 'good' | 'bad' | 'plain' }

/** Kinds `notify: important` keeps: the ones that change what you must do. */
export const IMPORTANT_KINDS: readonly ChangeKind[] = [
  'state',
  'merge',
  'checks',
  'thread',
  'review',
]

/**
 * Во что читается `mergeStateStatus`. Перечень значений задан схемой GraphQL
 * (docs.github.com/graphql/reference/pulls, enum `MergeStateStatus`, сверено
 * 25.09.2026) и состоит из восьми имён; описания оттуда же и определяют
 * раскладку. Значение, которого здесь нет, читается как `wait`, а не роняет
 * отрисовку: GitHub Enterprise Server отстаёт от github.com по схеме, и с
 * него может прийти как меньше значений, так и незнакомое.
 *
 * `good` - смержить можно сейчас; `bad` - нужно вмешательство в PR или
 * ветку; `wait` - штатный гейт ещё не пройден; `idle` - делать нечего.
 */
export type MergeLevel = 'good' | 'bad' | 'wait' | 'idle'

/** «Mergeable and passing commit status» и то же плюс pre-receive hooks. */
const MERGE_GOOD: ReadonlySet<string> = new Set(['CLEAN', 'HAS_HOOKS'])

/** Требуют правки PR или ветки: конфликт и отставание от базы. */
const MERGE_BAD: ReadonlySet<string> = new Set(['BEHIND', 'DIRTY'])

/** Ничего не требует: PR - черновик, и мерж заблокирован именно этим. */
const MERGE_IDLE: ReadonlySet<string> = new Set(['DRAFT'])

export function mergeLevel(status: string): MergeLevel {
  if (MERGE_GOOD.has(status)) return 'good'
  if (MERGE_BAD.has(status)) return 'bad'
  if (MERGE_IDLE.has(status)) return 'idle'

  // `BLOCKED` - гейт репозитория (ревью, обязательная проверка, резолв
  // тредов); `UNSTABLE` - мержить даёт, но проверка красная; `UNKNOWN` -
  // ещё считается. Все три - ожидание, а не поломка.
  return 'wait'
}

/** `CheckConclusionState`, свёрнутый в три исхода. */
const CHECK_OK: ReadonlySet<string> = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED'])

const CHECK_BAD: ReadonlySet<string> = new Set([
  'ACTION_REQUIRED',
  'CANCELLED',
  'ERROR',
  'FAILURE',
  'STARTUP_FAILURE',
  'TIMED_OUT',
])

export function checkLevel(word: string): CheckLevel {
  if (CHECK_OK.has(word)) return 'ok'
  if (CHECK_BAD.has(word)) return 'bad'

  // `PENDING`, `QUEUED`, `IN_PROGRESS`, `EXPECTED`, `WAITING`, `STALE` и всё,
  // чего в схеме ещё нет: проверка не сказала исхода, значит её ждут.
  return 'wait'
}

// --- Addresses -----------------------------------------------------------

const TRAILING_GIT = /\.git\/?$/

const splitRepo = (path: string, host: string): Remote | null => {
  const parts = path.replace(/^\/+|\/+$/g, '').split('/')

  // Ровно два сегмента: у GitHub путь репозитория - `owner/repo` и вложенных
  // групп нет вовсе. Три сегмента означают не подгруппу, а чужой адрес -
  // прокси или зеркало, и угадывать за него нельзя.
  if (parts.length !== 2) return null

  const owner = parts[0] ?? ''
  const repo = parts[1] ?? ''

  return host !== '' && owner !== '' && repo !== '' ? { host, owner, repo } : null
}

/**
 * The host, owner and repository of a git remote URL, in every form git
 * writes: `git@host:owner/repo.git`, `ssh://git@host:22/owner/repo`,
 * `https://user@host/owner/repo.git`. Null when the URL names no repository.
 */
export function remoteOf(url: string): Remote | null {
  const text = url.trim().replace(TRAILING_GIT, '')

  if (text === '') return null

  const scheme = /^(?:ssh|git|https?):\/\/(.+)$/.exec(text)

  if (scheme) {
    const rest = scheme[1] ?? ''
    const at = rest.lastIndexOf('@')
    const authority = at === -1 ? rest : rest.slice(at + 1)
    const slash = authority.indexOf('/')

    if (slash === -1) return null

    return splitRepo(
      authority.slice(slash + 1),
      authority.slice(0, slash).replace(/:\d+$/, ''),
    )
  }

  const scp = /^(?:[^@\s]+@)?([^@\s:]+):(.+)$/.exec(text)

  if (scp) return splitRepo(scp[2] ?? '', scp[1] ?? '')

  return null
}

/** A fresh global matcher: a shared one carries `lastIndex` between calls. */
export const prUrlRe = () =>
  /https?:\/\/([^/\s]+)\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/g

/** A prompt that is nothing but PR URLs toggles them and runs no model turn. */
export const isOnlyPrUrls = (text: string) =>
  /^\s*(https?:\/\/[^/\s]+\/[^/\s]+\/[^/\s]+\/pull\/\d+\S*\s*)+$/.test(text)

/** Every pull request named in a text, each once, in the order they appear. */
export function prRefsOf(text: string): PrRef[] {
  const out: PrRef[] = []
  const seen = new Set<string>()

  for (const match of text.matchAll(prUrlRe())) {
    const host = match[1] ?? ''
    const owner = match[2] ?? ''
    const repo = match[3] ?? ''
    const number = Number(match[4])

    if (host === '' || owner === '' || repo === '') continue
    if (!Number.isInteger(number) || number <= 0) continue

    const ref = { host, owner, repo, number }
    const key = keyOf(ref)

    if (seen.has(key)) continue

    seen.add(key)
    out.push(ref)
  }

  return out
}

export const keyOf = (ref: PrRef) => `${ref.host}/${ref.owner}/${ref.repo}#${ref.number}`

/** What the line calls it: the repository and the pull request's number. */
export const labelOf = (ref: PrRef) => `${ref.repo}#${ref.number}`

// --- Reading the API's JSON ---------------------------------------------

const rec = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const str = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback

const num = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const bool = (value: unknown, fallback = false) =>
  typeof value === 'boolean' ? value : fallback

/** The nodes of a GraphQL connection, whatever the connection is called. */
const nodesOf = (value: unknown): unknown[] => arr(rec(value).nodes)

const login = (value: unknown) => str(rec(value).login)

/** GitHub text reaches the terminal as it is written, so controls go first. */
export const clean = (text: string) =>
  text.replace(/[\u0000-\u001F\u007F]/g, ' ').trim()

/** The first line of a comment, whitespace collapsed, cut to `max`. */
export function oneLine(body: string, max = 160): string {
  const line = clean(body).replace(/\s+/g, ' ')

  return line.length > max ? `${line.slice(0, max - 3)}...` : line
}

/**
 * Review threads of a pull request. The comment's own `url` is the anchor -
 * GitHub gives it as `.../pull/7#discussion_r123`, so nothing has to be
 * assembled from an id (docs.github.com/graphql/reference/pulls,
 * `PullRequestReviewComment.url`, сверено 25.09.2026).
 *
 * `line` приходит null у треда, который устарел: строка, к которой он был
 * привязан, в новых коммитах уехала. Тогда берётся `originalLine` - адрес,
 * по которому тред и читают в интерфейсе.
 */
export function threadsOf(raw: unknown): Thread[] {
  const out: Thread[] = []

  for (const entry of nodesOf(raw)) {
    const thread = rec(entry)
    const head = rec(nodesOf(thread.comments)[0])
    const tail = rec(nodesOf(thread.tail)[0])

    // Тред без единого комментария нарисовать нечем: ни автора, ни текста.
    if (Object.keys(head).length === 0) continue

    const line = num(thread.line) || num(thread.originalLine)

    out.push({
      id: str(thread.id),
      resolved: bool(thread.isResolved),
      outdated: bool(thread.isOutdated),
      notes: num(rec(thread.comments).totalCount, 1),
      author: login(head.author),
      file: str(thread.path) || null,
      line: line === 0 ? null : line,
      body: oneLine(str(head.body)),
      lastAuthor: login(tail.author) || login(head.author),
      lastAt: str(tail.createdAt) || str(head.createdAt),
      url: str(head.url),
    })
  }

  return out
}

export function commitsOf(raw: unknown): Commit[] {
  return nodesOf(raw).map(entry => {
    const commit = rec(rec(entry).commit)
    const author = rec(commit.author)

    return {
      sha: str(commit.abbreviatedOid) || str(commit.oid).slice(0, 7),
      title: oneLine(str(commit.messageHeadline), 80),
      author: login(author.user) || clean(str(author.name)),
    }
  })
}

/**
 * The checks of the head commit. `statusCheckRollup` is null where nothing
 * reported at all, and that is drawn as no checks rather than as a green
 * light: «зелёных проверок нет» и «проверок нет» - разные факты.
 */
/** Слово, которым исход обязательных проверок называется в строке. */
const LEVEL_WORD: Record<CheckLevel, string> = {
  ok: 'success',
  bad: 'failure',
  wait: 'pending',
}

export function checksOf(raw: unknown): Checks {
  const rollup = rec(rec(rec(nodesOf(raw)[0]).commit).statusCheckRollup)
  const state = str(rollup.state)

  if (state === '') return null

  const contexts = nodesOf(rollup.contexts)
  const bad: Check[] = []
  let required = 0
  let worst: CheckLevel = 'ok'

  for (const entry of contexts) {
    const context = rec(entry)
    const isRun = str(context.__typename) === 'CheckRun'
    // У прогона исход появляется только после завершения: незавершённый
    // прогон - ожидание, а не `null`-исход, который читался бы как провал.
    const word = isRun
      ? str(context.status) === 'COMPLETED'
        ? str(context.conclusion, 'NEUTRAL')
        : str(context.status)
      : str(context.state)
    const level = checkLevel(word)
    const isRequired = bool(context.isRequired)

    if (isRequired) {
      required += 1

      // Провал обязательной перебивает ожидание: ждать нечего, править надо.
      if (level === 'bad') worst = 'bad'
      if (level === 'wait' && worst === 'ok') worst = 'wait'
    }

    if (level === 'ok') continue

    bad.push({
      name: clean(str(context.name) || str(context.context)),
      level,
      word: word.toLowerCase(),
      url: str(context.detailsUrl) || str(context.targetUrl),
      required: isRequired,
    })
  }

  return {
    level: required > 0 ? worst : checkLevel(state),
    word: required > 0 ? LEVEL_WORD[worst] : state.toLowerCase(),
    state,
    total: contexts.length,
    required,
    bad,
  }
}

/**
 * Who approved and who asked for changes, from `latestReviews` - «latest
 * reviews per user not also pending review» (docs.github.com/graphql/
 * reference/pulls, сверено 25.09.2026). Считать по всем ревью нельзя: один
 * человек оставляет их сколько угодно, и поздние отменяют ранние.
 */
export function reviewsOf(raw: unknown, decision: unknown): Reviews {
  const approved: string[] = []
  const changesRequested: string[] = []

  for (const entry of nodesOf(raw)) {
    const review = rec(entry)
    const name = login(review.author)

    if (name === '') continue

    if (str(review.state) === 'APPROVED') approved.push(name)
    if (str(review.state) === 'CHANGES_REQUESTED') changesRequested.push(name)
  }

  return { decision: str(decision) || null, approved, changesRequested }
}

const reviewerOf = (value: unknown) => {
  const who = rec(rec(value).requestedReviewer)

  return str(who.login) || str(who.name)
}

/**
 * Ответ одного опроса как есть: сам PR и страницы тредов, сколько их пришло.
 * Разбирается здесь, а собирается в `poll.ts` - тот модуль не импортирует
 * ничего в рантайме, чтобы прогон мог подменить источник.
 */
export type PollRaw = { pr: unknown; threadPages: readonly unknown[] }

/** Треды со всех страниц ответа, в порядке страниц. */
export const threadsOfPages = (pages: readonly unknown[]): Thread[] =>
  pages.flatMap(page => threadsOf(page))

/** One poll's answer, the pages folded into what the views read. */
export const prDataOfRaw = (raw: PollRaw): PrData =>
  prDataOf({ pr: raw.pr, threads: threadsOfPages(raw.threadPages) })

/** One poll's answer: the GraphQL payload folded into what the views read. */
export function prDataOf(input: { pr: unknown; threads: readonly Thread[] }): PrData {
  const pr = rec(input.pr)
  const commits = commitsOf(pr.commits)
  const head = nodesOf(pr.head)

  return {
    number: num(pr.number),
    title: clean(str(pr.title)),
    state: str(pr.state, 'UNKNOWN'),
    draft: bool(pr.isDraft),
    author: login(pr.author),
    headRefName: clean(str(pr.headRefName)),
    baseRefName: clean(str(pr.baseRefName)),
    webUrl: str(pr.url),
    mergeStatus: str(pr.mergeStateStatus, 'UNKNOWN'),
    mergeable: str(pr.mergeable, 'UNKNOWN'),
    additions: num(pr.additions),
    deletions: num(pr.deletions),
    changedFiles: num(pr.changedFiles),
    comments: num(rec(pr.comments).totalCount),
    labels: nodesOf(pr.labels).map(node => clean(str(rec(node).name))).filter(name => name !== ''),
    reviewers: nodesOf(pr.reviewRequests).map(reviewerOf).filter(name => name !== ''),
    assignees: nodesOf(pr.assignees).map(login).filter(name => name !== ''),
    checks: checksOf(pr.head),
    headSha: str(rec(rec(head[0]).commit).oid),
    updatedAt: str(pr.updatedAt),
    threads: input.threads,
    commits,
    commitsTotal: num(rec(pr.commits).totalCount, commits.length),
    reviews: reviewsOf(pr.latestReviews, pr.reviewDecision),
  }
}

// --- What moved between two polls ---------------------------------------

const threadWhere = (thread: Thread) =>
  thread.file === null
    ? 'в обсуждении кода'
    : `${thread.file}${thread.line === null ? '' : `:${thread.line}`}`

/** Что говорит вердикт ревью, словами строки и панели. */
export const decisionWord = (decision: string | null) =>
  decision === 'APPROVED'
    ? 'одобрен'
    : decision === 'CHANGES_REQUESTED'
      ? 'нужны правки'
      : decision === 'REVIEW_REQUIRED'
        ? 'ждёт ревью'
        : null

/**
 * The lines the session shows for one poll: empty on the first load, so a
 * newly watched pull request never announces its whole history at once.
 */
export function changesOf(previous: PrData | undefined, next: PrData): Change[] {
  if (!previous) return []

  const out: Change[] = []

  if (previous.state !== next.state) {
    out.push({
      kind: 'state',
      text: `состояние: ${previous.state} -> ${next.state}`,
      level: next.state === 'MERGED' ? 'good' : next.state === 'CLOSED' ? 'bad' : 'plain',
    })
  }

  if (previous.draft !== next.draft) {
    out.push({
      kind: 'state',
      text: next.draft ? 'переведён в draft' : 'снят draft',
      level: next.draft ? 'plain' : 'good',
    })
  }

  if (previous.mergeStatus !== next.mergeStatus) {
    const level = mergeLevel(next.mergeStatus)

    out.push({
      kind: 'merge',
      text: `merge: ${previous.mergeStatus} -> ${next.mergeStatus}`,
      level: level === 'good' ? 'good' : level === 'bad' ? 'bad' : 'plain',
    })
  }

  // Объявляется исход обязательных: красная необязательная джоба мержу не
  // мешает, и будить ею тостом значит приучить не смотреть на тосты. Весь
  // перечень, обязательный и нет, печатает `/pr checks`.
  const wasChecks = previous.checks?.word
  const isChecks = next.checks?.word

  if (isChecks !== undefined && wasChecks !== isChecks) {
    out.push({
      kind: 'checks',
      text: `проверки: ${wasChecks ?? 'нет'} -> ${isChecks}`,
      level:
        next.checks?.level === 'ok' ? 'good' : next.checks?.level === 'bad' ? 'bad' : 'plain',
    })
  }

  const before = new Map(previous.threads.map(thread => [thread.id, thread]))

  for (const thread of next.threads) {
    const was = before.get(thread.id)

    if (!was) {
      out.push({
        kind: 'thread',
        text: `новый тред от ${thread.author} (${threadWhere(thread)}): ${thread.body}`,
        level: 'bad',
      })

      continue
    }

    if (!was.resolved && thread.resolved) {
      out.push({
        kind: 'thread',
        text: `тред закрыт (${threadWhere(thread)}, автор ${thread.author})`,
        level: 'good',
      })
    }

    if (was.resolved && !thread.resolved) {
      out.push({
        kind: 'thread',
        text: `тред открыт заново (${threadWhere(thread)}, автор ${thread.author})`,
        level: 'bad',
      })
    }

    if (thread.notes > was.notes) {
      out.push({
        kind: 'comment',
        text: `+${thread.notes - was.notes} комментарий в треде ${threadWhere(thread)} (${thread.lastAuthor})`,
        level: 'plain',
      })
    }
  }

  const gone = previous.threads.filter(
    thread => !next.threads.some(current => current.id === thread.id),
  )

  if (gone.length > 0) {
    out.push({ kind: 'thread', text: `удалено тредов: ${gone.length}`, level: 'plain' })
  }

  if (next.comments > previous.comments) {
    out.push({
      kind: 'comment',
      text: `+${next.comments - previous.comments} комментарий в обсуждении PR`,
      level: 'plain',
    })
  }

  if (next.headSha !== previous.headSha) {
    const added = next.commitsTotal - previous.commitsTotal

    out.push({
      kind: 'commit',
      text: added > 0 ? `+${added} коммит в ветке` : 'ветка переписана (force push)',
      level: 'plain',
    })
  }

  if (previous.reviews.decision !== next.reviews.decision) {
    const word = decisionWord(next.reviews.decision)

    out.push({
      kind: 'review',
      text: `ревью: ${word ?? 'не требуется'}`,
      level:
        next.reviews.decision === 'APPROVED'
          ? 'good'
          : next.reviews.decision === 'CHANGES_REQUESTED'
            ? 'bad'
            : 'plain',
    })
  } else if (previous.reviews.approved.length !== next.reviews.approved.length) {
    const was = previous.reviews.approved.length
    const given = next.reviews.approved.length

    out.push({
      kind: 'review',
      text: `апрувы: ${given} (было ${was})`,
      level: given > was ? 'good' : 'plain',
    })
  }

  return out
}

/**
 * Адрес треда, ужатый до `max` колонок: голова пути уходит, хвост остаётся.
 * Обрезка с конца здесь не годится - имя файла и строка и есть то, ради чего
 * адрес показан, а докнутая панель бывает и в полсотни колонок шириной.
 */
export function shortenPath(path: string, max: number): string {
  if (max <= 0 || path.length <= max) return path

  const segments = path.split('/')

  // Хвост из как можно большего числа сегментов, влезающий вместе с '.../'.
  for (let from = 1; from < segments.length; from += 1) {
    const tail = `.../${segments.slice(from).join('/')}`

    if (tail.length <= max) return tail
  }

  // Не влезает и одно имя файла: режем его с начала, оставляя строку.
  const name = segments[segments.length - 1] ?? path

  return max <= 3 ? name.slice(-max) : `...${name.slice(-(max - 3))}`
}

/** `3/7` - open threads over all of them; what the line reads at a glance. */
export function threadTally(threads: readonly Thread[]) {
  return {
    open: threads.filter(thread => !thread.resolved).length,
    total: threads.length,
  }
}
