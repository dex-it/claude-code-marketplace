// An issue as the mod holds it, how jira-cli's output becomes one, and what
// changed between two polls of it. Pure: no `$`, no network, so the parsing and
// the diff are settled by tests and not by trying them in a session.
//
// jira-cli's `--raw` is not the REST response. `issue list --raw` prints its own
// flat structure (`fields.issueType`, `assignee.displayName` and nothing else
// about the person, `comment.total` always 0), while `issue view --raw` prints
// the REST body as is (comments with `author.name`, `self`). The two readers
// below follow those two shapes, checked against jira-cli 1.7.0 on a Server 9.2.

export type Issue = {
  key: string
  summary: string
  status: string
  type: string
  priority: string
  /** Display name; the list output carries no login or e-mail of the person. */
  assignee: string | null
  reporter: string | null
  created: string
  updated: string
  /** Name of the resolution; '' where none is set. Not a mark of "closed": see scope.ts. */
  resolution: string
  /**
   * Status category key (`new`, `indeterminate`, `done`) where the output has
   * it: the REST body of `issue view` does, the list output does not. '' - unknown.
   */
  category: string
  labels: string[]
  components: string[]
  watching: boolean
  description: string
  /**
   * Fingerprint of the description, kept where the text itself is not: the
   * snapshot between sessions drops the text, and "the description changed"
   * must still be decidable against it.
   */
  descFp: string
}

export type Comment = {
  id: string
  author: string
  /** `author.name`: what `jira me` prints on Server, so the mod can tell its own comments. */
  login: string
  /** Cloud has no `author.name`, and `jira me` prints the e-mail there. */
  email: string
  created: string
  text: string
}

export type Detail = {
  issue: Issue
  comments: Comment[]
  /** All comments of the issue; `comments` is the last page of them. */
  total: number
  /** Server address with its context path, taken from `self`; '' where absent. */
  baseUrl: string
}

export type Level = 'good' | 'bad' | 'wait' | 'info'

export type ChangeKind =
  | 'created'
  | 'status'
  | 'resolved'
  | 'reopened'
  | 'assignee'
  | 'priority'
  | 'summary'
  | 'description'
  | 'comment'

export type Change = { kind: ChangeKind; text: string; level: Level }

/** What `notify: important` still announces: the rest is edits of the issue's body. */
export const IMPORTANT_KINDS: readonly ChangeKind[] = [
  'created',
  'status',
  'resolved',
  'reopened',
  'assignee',
  'comment',
]

export const KEY_RE = /^[A-Z][A-Z0-9_]*-\d+$/

const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g
// Everything below space except tab and newline, DEL and the C1 block: foreign
// text reaches the terminal as is, and an escape in a summary repaints it.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g

export const rec = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

/** Foreign text made safe to draw: colour codes and control characters out, line ends unified. */
export const clean = (value: string): string =>
  value.replace(ANSI, '').replace(/\r\n?/g, '\n').replace(CONTROL, '')

export const firstLine = (text: string, max = 100): string => {
  const line = clean(text)
    .split('\n')
    .map(part => part.trim())
    .find(part => part !== '')

  if (line === undefined) return ''

  return line.length > max ? `${line.slice(0, max - 1)}...` : line
}

/** jira-cli prints `+0300`, ISO wants `+03:00`; V8 reads both, other hosts may not. */
export function parseTime(value: string): number {
  const fixed = value.replace(/([+-]\d\d)(\d\d)$/, '$1:$2')
  const ms = Date.parse(fixed)

  return Number.isNaN(ms) ? 0 : ms
}

/**
 * Atlassian Document Format (Jira Cloud, REST v3) to text. Server and Data
 * Center send the body as a string of wiki markup, which is kept as written.
 */
function adfText(node: unknown): string {
  const item = rec(node)
  const type = str(item.type)

  if (type === 'text') return str(item.text)
  if (type === 'hardBreak') return '\n'
  if (type === 'mention') return str(rec(item.attrs).text)
  if (type === 'emoji') return str(rec(item.attrs).shortName)

  const inner = list(item.content).map(adfText).join('')

  return ['paragraph', 'heading', 'listItem', 'codeBlock', 'blockquote'].includes(type)
    ? `${inner}\n`
    : inner
}

export function textOfBody(value: unknown): string {
  if (typeof value === 'string') return clean(value)

  return clean(adfText(value)).trim()
}

/** FNV-1a over the text with its length: enough to see an edit, not a signature. */
export function fingerprint(text: string): string {
  let hash = 0x811c9dc5

  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0
  }

  return `${text.length.toString(36)}-${hash.toString(36)}`
}

const nameOf = (value: unknown): string | null => {
  const item = rec(value)
  const name = str(item.displayName) || str(item.name)

  return name === '' ? null : clean(name)
}

/** One entry of `issue list --raw`, or of `issue view --raw`: both carry `key` and `fields`. */
export function issueOfRaw(raw: unknown): Issue | null {
  const item = rec(raw)
  const key = str(item.key)

  if (!KEY_RE.test(key)) return null

  const fields = rec(item.fields)
  // List output says `issueType`, the REST body says `issuetype`.
  const type = nameOf(fields.issueType) ?? nameOf(fields.issuetype) ?? ''
  const watches = rec(fields.watches)
  const description = textOfBody(fields.description)
  const names = (value: unknown) =>
    list(value)
      .map(entry => (typeof entry === 'string' ? entry : (nameOf(entry) ?? '')))
      .filter(name => name !== '')
      .map(clean)

  return {
    key,
    summary: clean(str(fields.summary)),
    status: nameOf(fields.status) ?? '',
    type,
    priority: nameOf(fields.priority) ?? '',
    assignee: nameOf(fields.assignee),
    reporter: nameOf(fields.reporter),
    created: str(fields.created),
    updated: str(fields.updated),
    resolution: nameOf(fields.resolution) ?? '',
    category: str(rec(rec(fields.status).statusCategory).key),
    labels: names(fields.labels),
    components: names(fields.components),
    watching: watches.isWatching === true || watches.watching === true,
    description,
    descFp: fingerprint(description.trim()),
  }
}

/** `issue list --raw`: a JSON array; nothing at all where the query found nothing. */
export function issuesOfStdout(stdout: string): Issue[] {
  const body = stdout.trim()

  if (body === '' || body === 'null') return []

  const parsed: unknown = JSON.parse(body)

  return list(parsed).flatMap(entry => {
    const issue = issueOfRaw(entry)

    return issue === null ? [] : [issue]
  })
}

/** `issue view --raw`; null where the body is not an issue. */
export function detailOfRaw(raw: unknown): Detail | null {
  const issue = issueOfRaw(raw)

  if (issue === null) return null

  const item = rec(raw)
  const block = rec(rec(item.fields).comment)
  const self = str(item.self)
  const cut = self.indexOf('/rest/')

  const comments = list(block.comments).flatMap((entry): Comment[] => {
    const comment = rec(entry)
    const author = rec(comment.author)
    const id = str(comment.id)

    if (id === '') return []

    return [
      {
        id,
        author: nameOf(author) ?? '?',
        login: clean(str(author.name)),
        email: clean(str(author.emailAddress)),
        created: str(comment.created),
        text: textOfBody(comment.body),
      },
    ]
  })

  return {
    issue,
    comments,
    total: typeof block.total === 'number' ? block.total : comments.length,
    baseUrl: cut > 0 ? self.slice(0, cut) : '',
  }
}

/** `--plain --no-headers --columns key`: one key per line, whatever else the CLI wrote. */
export function keysOfPlain(stdout: string): string[] {
  return clean(stdout)
    .split('\n')
    .map(line => line.trim().split(/\s+/)[0] ?? '')
    .filter(token => KEY_RE.test(token))
}

export const browseUrl = (baseUrl: string, key: string): string =>
  baseUrl === '' ? '' : `${baseUrl}/browse/${key}`

// --- What changed between two polls ---------------------------------------

export type Flags = {
  wasMine: boolean
  isMine: boolean
  /** In the closed group before and now: decided by the poll's status-category queries. */
  wasDone: boolean
  isDone: boolean
}

const NOBODY = 'не назначен'

/**
 * The difference between what the mod held and what the poll brought. The
 * first sight of an issue has nothing to compare and announces nothing; an
 * issue that appears later is the caller's `created`, not a change.
 *
 * Comments are not here: the list does not carry them, and they come from
 * `commentChanges` once `updated` has moved and the issue has been viewed.
 */
export function changesOf(prev: Issue, next: Issue, mine: Flags): Change[] {
  const out: Change[] = []

  if (!mine.wasDone && mine.isDone) {
    const how = next.resolution === '' ? '' : ` (${next.resolution})`

    out.push({ kind: 'resolved', level: 'good', text: `закрыта: ${next.status}${how}` })
  } else if (mine.wasDone && !mine.isDone) {
    out.push({ kind: 'reopened', level: 'bad', text: `открыта заново: ${next.status}` })
  } else if (prev.status !== next.status) {
    out.push({ kind: 'status', level: 'info', text: `статус: ${prev.status} -> ${next.status}` })
  }

  if (!mine.wasMine && mine.isMine) {
    out.push({ kind: 'assignee', level: 'wait', text: 'назначена на вас' })
  } else if (prev.assignee !== next.assignee) {
    const to = next.assignee ?? NOBODY

    out.push({
      kind: 'assignee',
      level: 'info',
      text: mine.wasMine
        ? `снята с вас, исполнитель: ${to}`
        : `исполнитель: ${prev.assignee ?? NOBODY} -> ${to}`,
    })
  }

  if (prev.priority !== next.priority) {
    out.push({
      kind: 'priority',
      level: 'info',
      text: `приоритет: ${prev.priority || '-'} -> ${next.priority || '-'}`,
    })
  }

  if (prev.summary !== next.summary) {
    out.push({ kind: 'summary', level: 'info', text: `переименована: ${firstLine(next.summary, 80)}` })
  }

  if (prev.descFp !== next.descFp) {
    out.push({ kind: 'description', level: 'info', text: 'описание изменено' })
  }

  return out
}

export const createdChange = (issue: Issue): Change => ({
  kind: 'created',
  level: 'info',
  text: `новая: ${issue.type === '' ? '' : `${issue.type}, `}${firstLine(issue.summary, 80)}`,
})

/** Does the comment text address this login the way Jira Server marks a mention. */
export const mentions = (text: string, login: string | null): boolean =>
  login !== null && login !== '' && text.includes(`[~${login}]`)

/**
 * Comments written after `sinceMs`, by someone else. `sinceMs` is the issue's
 * previous `updated`: adding a comment moves it, so everything newer than the
 * last poll is new, with no need to remember comment ids between sessions.
 */
export function commentChanges(
  comments: readonly Comment[],
  sinceMs: number,
  login: string | null,
): Change[] {
  return comments
    .filter(comment => parseTime(comment.created) > sinceMs)
    .filter(comment => login === null || (comment.login !== login && comment.email !== login))
    .map(comment => {
      const asked = mentions(comment.text, login)

      return {
        kind: 'comment',
        level: asked ? 'wait' : 'info',
        text: `${comment.author}${asked ? ' упомянул вас' : ''}: ${firstLine(comment.text, 90)}`,
      } satisfies Change
    })
}
