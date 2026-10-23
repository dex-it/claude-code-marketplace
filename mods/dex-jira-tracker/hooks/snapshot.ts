// The followed set between sessions. What was held when the last session
// ended is kept in the plugin's store; the next session compares its first poll
// with it, so "a colleague answered while Claude was closed" arrives as one
// digest instead of being lost. Pure: reading the store back is defensive,
// because the store keeps whatever an older version of the mod wrote.

import type { Change, Issue } from './jira.ts'
import { rec } from './jira.ts'
import type { Group, Tracked } from './watched.ts'

export type Snapshot = { v: 1; savedMs: number; items: Tracked[] }

/** A snapshot older than this is not a "previous state" any more: everything would read as changed. */
export const SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

const LEVELS = new Set(['good', 'bad', 'wait', 'info'])
const GROUPS = new Set<string>(['progress', 'open', 'done'])

/** Description text is not kept: `descFp` answers "did it change", and the text is large. */
const slim = (issue: Issue): Issue => ({ ...issue, description: '' })

export function toSnapshot(set: ReadonlyMap<string, Tracked>, savedMs: number): Snapshot {
  return {
    v: 1,
    savedMs,
    items: [...set.values()].map(entry => {
      const item: Tracked = {
        key: entry.key,
        issue: slim(entry.issue),
        group: entry.group,
        mine: entry.mine,
        fresh: entry.fresh,
      }

      if (entry.branch !== undefined) item.branch = entry.branch

      return item
    }),
  }
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []

function issueOf(value: unknown): Issue | null {
  const item = rec(value)
  const key = str(item.key)

  if (key === '') return null

  return {
    key,
    summary: str(item.summary),
    status: str(item.status),
    type: str(item.type),
    priority: str(item.priority),
    assignee: typeof item.assignee === 'string' ? item.assignee : null,
    reporter: typeof item.reporter === 'string' ? item.reporter : null,
    created: str(item.created),
    updated: str(item.updated),
    resolution: str(item.resolution),
    category: str(item.category),
    labels: strings(item.labels),
    components: strings(item.components),
    watching: item.watching === true,
    description: '',
    descFp: str(item.descFp),
  }
}

function freshOf(value: unknown): Change[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry): Change[] => {
    const change = rec(entry)
    const level = str(change.level)

    if (str(change.text) === '' || !LEVELS.has(level)) return []

    return [{ kind: str(change.kind) as Change['kind'], level: level as Change['level'], text: str(change.text) }]
  })
}

/** The set the snapshot held; null where there is none, it is unreadable or too old. */
export function fromSnapshot(
  value: unknown,
  nowMs: number,
): Map<string, Tracked> | null {
  const body = rec(value)

  if (body.v !== 1 || typeof body.savedMs !== 'number' || !Array.isArray(body.items)) return null
  if (nowMs - body.savedMs > SNAPSHOT_MAX_AGE_MS) return null

  const set = new Map<string, Tracked>()

  for (const raw of body.items) {
    const item = rec(raw)
    const issue = issueOf(item.issue)
    const group = str(item.group)

    if (issue === null || !GROUPS.has(group)) continue

    const entry: Tracked = {
      key: issue.key,
      issue,
      group: group as Group,
      mine: item.mine === true,
      fresh: freshOf(item.fresh),
    }

    if (str(item.branch) !== '') entry.branch = str(item.branch)

    set.set(entry.key, entry)
  }

  return set.size === 0 ? null : set
}

/** Where the snapshot lives: one per scope, so switching scope does not compare apples with oranges. */
export function snapshotKey(input: { project: string; scope: string; jql: string }): string {
  const raw = `${input.project || 'default'}|${input.scope}|${input.scope === 'jql' ? input.jql : ''}`

  return `snapshot:${raw.replace(/[^A-Za-z0-9_.|=!<>() -]/g, '_').slice(0, 120)}`
}
