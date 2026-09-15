// What GitLab says, read as plain data: the remote's host and project, MR
// references in text, the REST answers shaped into what the mod draws, and
// what moved between two polls. Nothing here touches `$` - it is the half
// that tests run on their own.

export type Remote = { host: string; project: string }

/** One merge request, addressed the way every call and every key spells it. */
export type MrRef = { host: string; project: string; iid: number }

export type Thread = {
  id: string
  /** GitLab lets the thread be resolved: a diff thread, not a plain note. */
  resolvable: boolean
  resolved: boolean
  /** Comments in the thread, system events (title changed, ...) left out. */
  notes: number
  author: string
  /** The file the thread sits on, null for a thread on the MR itself. */
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
 * Null where the instance answers nothing about approvals. `required` is
 * null where it answers who approved but names no rule: approval rules are a
 * paid feature, and a free instance still reports `approved_by`.
 */
export type Approvals =
  | { required: number | null; left: number | null; by: string[] }
  | null

export type Pipeline = { status: string; webUrl: string } | null

export type MrData = {
  iid: number
  title: string
  /** `opened`, `merged`, `closed`, `locked`. */
  state: string
  draft: boolean
  author: string
  sourceBranch: string
  targetBranch: string
  webUrl: string
  /** `detailed_merge_status` where the instance has it, else `merge_status`. */
  mergeStatus: string
  hasConflicts: boolean
  discussionsResolved: boolean
  /** GitLab's own string: a number, or `1000+` on a huge diff. */
  changesCount: string
  notesCount: number
  upvotes: number
  downvotes: number
  labels: string[]
  reviewers: string[]
  assignees: string[]
  pipeline: Pipeline
  headSha: string
  updatedAt: string
  threads: Thread[]
  commits: Commit[]
  /** True when the commit page filled up: the count is a floor, not a total. */
  commitsCapped: boolean
  approvals: Approvals
}

export type ChangeKind =
  | 'state'
  | 'merge'
  | 'pipeline'
  | 'thread'
  | 'comment'
  | 'commit'
  | 'approval'

export type Change = { kind: ChangeKind; text: string; level: 'good' | 'bad' | 'plain' }

/** Kinds `notify: important` keeps: the ones that change what you must do. */
export const IMPORTANT_KINDS: readonly ChangeKind[] = [
  'state',
  'merge',
  'pipeline',
  'thread',
  'approval',
]

/**
 * Во что читается `detailed_merge_status`. Перечень значений взят из
 * документации GitLab (docs.gitlab.com/api/merge_requests, раздел "Merge
 * status", сверено 15.09.2026), и набор там растёт от версии к версии -
 * поэтому значение, которого здесь нет, читается как `wait`, а не роняет
 * отрисовку: на старом self-managed придёт меньше значений, на новом может
 * прийти незнакомое.
 *
 * `good` - смержить можно сейчас; `bad` - нужно вмешательство в MR или
 * ветку; `wait` - штатный гейт ещё не пройден; `idle` - делать нечего.
 */
export type MergeLevel = 'good' | 'bad' | 'wait' | 'idle'

/** Требуют правки MR или ветки. */
const MERGE_BAD: ReadonlySet<string> = new Set([
  'commits_status',
  'conflict',
  'locked_lfs_files',
  'locked_paths',
  'merge_request_blocked',
  'need_rebase',
  'requested_changes',
  'security_policy_violations',
])

/** Ничего не требуют: MR либо не открыт, либо ждёт назначенного времени. */
const MERGE_IDLE: ReadonlySet<string> = new Set(['draft_status', 'merge_time', 'not_open'])

export function mergeLevel(status: string): MergeLevel {
  // `can_be_merged` - значение устаревшего `merge_status`, на который мод
  // падает обратно там, где инстанс старше 15.6 и `detailed_merge_status`
  // не отдаёт.
  if (status === 'mergeable' || status === 'can_be_merged') return 'good'
  if (MERGE_BAD.has(status)) return 'bad'
  if (MERGE_IDLE.has(status)) return 'idle'

  return 'wait'
}

// --- Addresses -----------------------------------------------------------

const TRAILING_GIT = /\.git\/?$/

/**
 * The host and project path of a git remote URL, in every form git writes:
 * `git@host:group/proj.git`, `ssh://git@host:22/group/proj`,
 * `https://user@host/group/sub/proj.git`. Null when the URL names neither.
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

    const host = authority.slice(0, slash).replace(/:\d+$/, '')
    const project = authority.slice(slash + 1).replace(/^\/+|\/+$/g, '')

    return host !== '' && project !== '' ? { host, project } : null
  }

  const scp = /^(?:[^@\s]+@)?([^@\s:]+):(.+)$/.exec(text)

  if (scp) {
    const host = scp[1] ?? ''
    const project = (scp[2] ?? '').replace(/^\/+|\/+$/g, '')

    return host !== '' && project !== '' ? { host, project } : null
  }

  return null
}

/** A fresh global matcher: a shared one carries `lastIndex` between calls. */
export const mrUrlRe = () =>
  /https?:\/\/([^/\s]+)\/([^\s]+?)\/-\/merge_requests\/(\d+)/g

/** A prompt that is nothing but MR URLs toggles them and runs no model turn. */
export const isOnlyMrUrls = (text: string) =>
  /^\s*(https?:\/\/[^/\s]+\/\S+?\/-\/merge_requests\/\d+\S*\s*)+$/.test(text)

/** Every MR named in a text, each once, in the order they appear. */
export function mrRefsOf(text: string): MrRef[] {
  const out: MrRef[] = []
  const seen = new Set<string>()

  for (const match of text.matchAll(mrUrlRe())) {
    const host = match[1] ?? ''
    const project = (match[2] ?? '').replace(/\/+$/, '')
    const iid = Number(match[3])

    if (host === '' || project === '' || !Number.isInteger(iid) || iid <= 0) continue

    const ref = { host, project, iid }
    const key = keyOf(ref)

    if (seen.has(key)) continue

    seen.add(key)
    out.push(ref)
  }

  return out
}

export const keyOf = (ref: MrRef) => `${ref.host}/${ref.project}!${ref.iid}`

/** What the line calls it: the project's last segment and the MR's number. */
export const labelOf = (ref: MrRef) =>
  `${ref.project.split('/').pop() ?? ref.project}!${ref.iid}`

export const projectId = (project: string) => encodeURIComponent(project)

export const mrPath = (ref: MrRef) =>
  `projects/${projectId(ref.project)}/merge_requests/${ref.iid}`

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

const idOf = (value: unknown) =>
  typeof value === 'number' ? String(value) : str(value)

const userOf = (value: unknown) => {
  const user = rec(value)

  return str(user.username) || str(user.name)
}

const usersOf = (value: unknown) => arr(value).map(userOf).filter(name => name !== '')

/** GitLab text reaches the terminal as it is written, so controls go first. */
export const clean = (text: string) =>
  text.replace(/[\u0000-\u001F\u007F]/g, ' ').trim()

/** The first line of a comment, whitespace collapsed, cut to `max`. */
export function oneLine(body: string, max = 160): string {
  const line = clean(body).replace(/\s+/g, ' ')

  return line.length > max ? `${line.slice(0, max - 3)}...` : line
}

/**
 * Threads of an MR: standalone comments (`individual_note`) are not threads.
 *
 * Допущение: REST не отдаёт состояния на уровне обсуждения - `resolved` и
 * `resolvable` есть только у каждой заметки (docs.gitlab.com/api/discussions,
 * сверено 15.09.2026), а правило агрегации документацией не задано. Мод
 * считает тред закрытым, когда закрыты все его резолвимые заметки; счётчики
 * тредов на уровне MR есть только в GraphQL.
 */
export function threadsOf(raw: unknown, webUrl: string): Thread[] {
  const out: Thread[] = []

  for (const entry of arr(raw)) {
    const discussion = rec(entry)

    if (bool(discussion.individual_note)) continue

    const notes = arr(discussion.notes).map(rec).filter(note => !bool(note.system))
    const first = notes[0]

    if (!first) continue

    const last = notes[notes.length - 1] ?? first
    const position = rec(first.position)
    const resolvable = notes.filter(note => bool(note.resolvable))

    out.push({
      id: idOf(discussion.id),
      resolvable: resolvable.length > 0,
      resolved: resolvable.length > 0 && resolvable.every(note => bool(note.resolved)),
      notes: notes.length,
      author: userOf(first.author),
      file: str(position.new_path) || str(position.old_path) || null,
      line: num(position.new_line) || num(position.old_line) || null,
      body: oneLine(str(first.body)),
      lastAuthor: userOf(last.author),
      lastAt: str(last.updated_at) || str(last.created_at),
      // Допущение: форма якоря заметки документацией GitLab не задана
      // (документирован только `Note.url` в GraphQL). Проверена живым
      // переходом 15.09.2026; сломается - ссылка ведёт на сам MR.
      url: `${webUrl}#note_${idOf(first.id)}`,
    })
  }

  return out
}

export function commitsOf(raw: unknown): Commit[] {
  return arr(raw).map(entry => {
    const commit = rec(entry)

    return {
      sha: str(commit.short_id) || idOf(commit.id).slice(0, 8),
      title: oneLine(str(commit.title), 80),
      author: clean(str(commit.author_name)),
    }
  })
}

/**
 * The approvals endpoint where the instance answers it; null on a plan that
 * does not, so nothing is drawn instead of a wrong `0/0`. An instance that
 * reports the approvers but no rule (the free tier does: `approved_by` with
 * no `approvals_required`) gives a null `required`, and the views then count
 * approvals instead of drawing a quota nobody set.
 */
export function approvalsOf(raw: unknown): Approvals {
  const payload = rec(raw)

  if (!('approvals_required' in payload) && !('approved_by' in payload)) return null

  const required =
    typeof payload.approvals_required === 'number' ? payload.approvals_required : null

  return {
    required,
    left: typeof payload.approvals_left === 'number' ? payload.approvals_left : null,
    by: arr(payload.approved_by)
      .map(entry => userOf(rec(entry).user))
      .filter(name => name !== ''),
  }
}

/** How many approvals are in, whichever of the two shapes the instance sent. */
export const approvalsGiven = (approvals: NonNullable<Approvals>) =>
  approvals.required !== null && approvals.left !== null
    ? approvals.required - approvals.left
    : approvals.by.length

function pipelineOf(raw: unknown): Pipeline {
  const pipeline = rec(raw)
  const status = str(pipeline.status)

  return status === '' ? null : { status, webUrl: str(pipeline.web_url) }
}

/** One poll's answer, the four calls folded into what the views read. */
export function mrDataOf(input: {
  mr: unknown
  discussions: unknown
  commits: unknown
  approvals: unknown
  commitsPageSize: number
}): MrData {
  const mr = rec(input.mr)
  const webUrl = str(mr.web_url)
  const commits = commitsOf(input.commits)

  return {
    iid: num(mr.iid),
    title: clean(str(mr.title)),
    state: str(mr.state, 'unknown'),
    draft: bool(mr.draft) || bool(mr.work_in_progress),
    author: userOf(mr.author),
    sourceBranch: clean(str(mr.source_branch)),
    targetBranch: clean(str(mr.target_branch)),
    webUrl,
    mergeStatus: str(mr.detailed_merge_status) || str(mr.merge_status, 'unknown'),
    hasConflicts: bool(mr.has_conflicts),
    discussionsResolved: bool(mr.blocking_discussions_resolved, true),
    changesCount: clean(str(mr.changes_count)),
    notesCount: num(mr.user_notes_count),
    upvotes: num(mr.upvotes),
    downvotes: num(mr.downvotes),
    labels: arr(mr.labels)
      .map(label => clean(str(label)))
      .filter(label => label !== ''),
    reviewers: usersOf(mr.reviewers),
    assignees: usersOf(mr.assignees),
    pipeline: pipelineOf(mr.head_pipeline) ?? pipelineOf(mr.pipeline),
    headSha: str(mr.sha),
    updatedAt: str(mr.updated_at),
    threads: threadsOf(input.discussions, webUrl),
    commits,
    commitsCapped: commits.length >= input.commitsPageSize,
    approvals: approvalsOf(input.approvals),
  }
}

// --- What moved between two polls ---------------------------------------

const threadWhere = (thread: Thread) =>
  thread.file === null
    ? 'в обсуждении MR'
    : `${thread.file}${thread.line === null ? '' : `:${thread.line}`}`

/**
 * The lines the session shows for one poll: empty on the first load, so a
 * newly watched MR never announces its whole history at once.
 */
export function changesOf(previous: MrData | undefined, next: MrData): Change[] {
  if (!previous) return []

  const out: Change[] = []

  if (previous.state !== next.state) {
    out.push({
      kind: 'state',
      text: `состояние: ${previous.state} -> ${next.state}`,
      level: next.state === 'merged' ? 'good' : next.state === 'closed' ? 'bad' : 'plain',
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

  const wasPipeline = previous.pipeline?.status
  const isPipeline = next.pipeline?.status

  if (isPipeline !== undefined && wasPipeline !== isPipeline) {
    out.push({
      kind: 'pipeline',
      text: `пайплайн: ${wasPipeline ?? 'нет'} -> ${isPipeline}`,
      level: isPipeline === 'success' ? 'good' : isPipeline === 'failed' ? 'bad' : 'plain',
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

  if (next.headSha !== previous.headSha) {
    const added = next.commits.length - previous.commits.length

    out.push({
      kind: 'commit',
      text: added > 0 ? `+${added} коммит в ветке` : 'ветка переписана (force push)',
      level: 'plain',
    })
  }

  const wasApprovals = previous.approvals
  const isApprovals = next.approvals

  if (wasApprovals && isApprovals) {
    const was = approvalsGiven(wasApprovals)
    const given = approvalsGiven(isApprovals)

    if (was !== given) {
      const quota = isApprovals.required === null ? '' : `/${isApprovals.required}`

      out.push({
        kind: 'approval',
        text: `апрувы: ${given}${quota} (было ${was})`,
        level: isApprovals.left === 0 || given > was ? 'good' : 'plain',
      })
    }
  }

  return out
}

/** `3/7` - open threads over resolvable ones; what the line reads at a glance. */
export function threadTally(threads: readonly Thread[]) {
  const resolvable = threads.filter(thread => thread.resolvable)

  return {
    open: resolvable.filter(thread => !thread.resolved).length,
    resolvable: resolvable.length,
    total: threads.length,
  }
}
