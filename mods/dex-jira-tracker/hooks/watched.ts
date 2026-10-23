// One followed issue as the session holds it: the last answer for it, which
// group it is in, whether it is the person's, and what has changed in it since
// the person last looked.

import type { Change, Detail, Issue } from './jira.ts'

/** `progress` - status category "In Progress"; `open` - everything else unresolved; `done` - resolved. */
export type Group = 'progress' | 'open' | 'done'

export type Tracked = {
  key: string
  issue: Issue
  group: Group
  /** Assigned to the person the CLI is signed in as. */
  mine: boolean
  /**
   * Announced changes the person has not acknowledged yet, oldest first. The
   * list marks such an issue, and opening its details (or `/jira seen`) clears it.
   */
  fresh: Change[]
  /** Loaded when details are opened or a comment is looked for; absent before. */
  detail?: Detail
  /** The branch `/jira work` started for it. */
  branch?: string
}

/** Closed is "not among the open keys"; of the open ones, those in category "In Progress" are in work. */
export const groupOf = (
  issue: Issue,
  openKeys: ReadonlySet<string>,
  inProgress: ReadonlySet<string>,
): Group => (!openKeys.has(issue.key) ? 'done' : inProgress.has(issue.key) ? 'progress' : 'open')

/** The group of an issue fetched alone, by its own status category. */
export const groupOfCategory = (issue: Issue): Group =>
  issue.category === 'done' ? 'done' : issue.category === 'indeterminate' ? 'progress' : 'open'

export const trackedOf = (
  issue: Issue,
  group: Group,
  mine: boolean,
  fresh: Change[] = [],
): Tracked => ({ key: issue.key, issue, group, mine, fresh })

/** Fresh changes kept per issue: the list shows the last one, details show these. */
export const FRESH_LIMIT = 8

export const withFresh = (entry: Tracked, changes: readonly Change[]): void => {
  entry.fresh = [...entry.fresh, ...changes].slice(-FRESH_LIMIT)
}
