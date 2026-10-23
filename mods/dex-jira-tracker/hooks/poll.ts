// What one poll does to the followed set: which issues are new, which changed
// and how, and which of them are worth a second call to find new comments.
// Pure: the three answers the CLI gave come in, the next set and its
// announcements go out, so the rules are settled by tests.

import type { Change, Comment, Detail, Issue } from './jira.ts'
import { changesOf, commentChanges, createdChange, parseTime } from './jira.ts'
import type { Page, Source } from './backend.ts'
import type { Queries } from './scope.ts'
import type { Tracked } from './watched.ts'
import { groupOf, trackedOf, withFresh } from './watched.ts'

export type Poll = {
  issues: readonly Issue[]
  /** Keys of the issues that are not done. */
  open: ReadonlySet<string>
  /** Keys of the issues in status category "In Progress". */
  progress: ReadonlySet<string>
  /** Keys of the open issues assigned to the person. */
  mine: ReadonlySet<string>
}

export type Outcome = {
  /** The followed set after the poll, in the order Jira returned it. */
  next: Map<string, Tracked>
  /** Changes found per issue, without comments. Empty on the first poll. */
  announced: { key: string; changes: Change[] }[]
  /** Issues whose `updated` moved: their comments are looked for with a view. */
  look: { key: string; sinceMs: number }[]
}

/**
 * Compare a poll with the set held. `isFirst` is a poll with nothing to compare
 * against - the first of a scope, or the first after it was changed: it fills
 * the set and announces nothing, so that following an issue does not pour its
 * whole history on the person.
 */
export function applyPoll(
  prev: ReadonlyMap<string, Tracked>,
  poll: Poll,
  isFirst: boolean,
): Outcome {
  const next = new Map<string, Tracked>()
  const announced: Outcome['announced'] = []
  const look: Outcome['look'] = []

  for (const issue of poll.issues) {
    const group = groupOf(issue, poll.open, poll.progress)
    const mine = poll.mine.has(issue.key)
    const old = prev.get(issue.key)

    if (old === undefined) {
      const entry = trackedOf(issue, group, mine)

      if (!isFirst) {
        const changes = [createdChange(issue)]

        withFresh(entry, changes)
        announced.push({ key: issue.key, changes })
      }

      next.set(issue.key, entry)

      continue
    }

    const changes = changesOf(old.issue, issue, {
      wasMine: old.mine,
      isMine: mine,
      wasDone: old.group === 'done',
      isDone: group === 'done',
    })
    // `detail` is dropped: it describes the issue as it was, and the next view brings a new one.
    const entry: Tracked = { ...old, issue, group, mine }

    delete entry.detail
    withFresh(entry, changes)
    next.set(issue.key, entry)

    if (changes.length > 0) announced.push({ key: issue.key, changes })

    if (issue.updated !== old.issue.updated && group !== 'done') {
      look.push({ key: issue.key, sinceMs: parseTime(old.issue.updated) })
    }
  }

  return { next, announced, look }
}

/** New comments of one issue, written into its fresh list; returns what was added. */
export function applyComments(
  entry: Tracked,
  detail: Detail,
  sinceMs: number,
  login: string | null,
): Change[] {
  const changes = commentChanges(detail.comments, sinceMs, login)

  entry.detail = detail
  withFresh(entry, changes)

  return changes
}

export const lastComments = (detail: Detail, count: number): Comment[] =>
  detail.comments.slice(-count)

/**
 * The questions a poll asks, in parallel: the issues themselves, and which of
 * the same set are open, in progress and the person's. Three of the four ask
 * for keys only, which the CLI prints without the bodies.
 */
export async function pollSource(source: Source, queries: Queries, limit: number): Promise<{
  poll: Poll
  page: Page
}> {
  const [page, open, progress, mine] = await Promise.all([
    source.list(queries.base, limit),
    source.keys(queries.open, limit),
    source.keys(queries.progress, limit),
    source.keys(queries.mine, limit),
  ])

  return { poll: { issues: page.issues, open, progress, mine }, page }
}
