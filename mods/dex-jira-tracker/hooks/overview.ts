// The list of followed issues as one summary and an ordered set of rows. It
// answers one question - what is waiting for me - where the details pane
// answers what exactly is in an issue.
//
// Pure: no `$`, no network. The order of rows and the rule of attention are
// judgements about the subject and not about drawing, so tests hold them.

import { parseTime } from './jira.ts'
import type { Tracked } from './watched.ts'

/**
 * `act` - yours, and something changed since you looked. `fresh` - not yours,
 * but something changed. `live` - open, nothing new. `idle` - closed.
 */
export type Attention = 'act' | 'fresh' | 'live' | 'idle'

const ORDER: readonly Attention[] = ['act', 'fresh', 'live', 'idle']

export const ATTENTION_ONE: Record<Attention, string> = {
  act: 'ждёт вас',
  fresh: 'есть новое',
  live: 'без изменений',
  idle: 'закрыта',
}

export const ATTENTION_MANY: Record<Attention, string> = {
  act: 'ждут вас',
  fresh: 'с новым',
  live: 'без изменений',
  idle: 'закрыто',
}

/** What the list can be narrowed to; `all` is the whole of it. */
export type Filter = 'all' | 'progress' | 'open' | 'mine' | 'fresh' | 'done'

export const FILTERS: readonly Filter[] = ['all', 'progress', 'open', 'mine', 'fresh', 'done']

export const FILTER_WORD: Record<Filter, string> = {
  all: 'все',
  progress: 'в работе',
  open: 'открытые',
  mine: 'мои',
  fresh: 'новое',
  done: 'закрытые',
}

export const filterOf = (value: string, fallback: Filter): Filter =>
  FILTERS.find(filter => filter === value) ?? fallback

export type Row = {
  key: string
  attention: Attention
  group: Tracked['group']
  mine: boolean
  status: string
  type: string
  priority: string
  assignee: string
  summary: string
  /** Why the row stands where it does: the last unacknowledged change, else the status. */
  reason: string
  freshCount: number
  branch: string
}

export type Overview = {
  rows: readonly Row[]
  total: number
  progress: number
  open: number
  done: number
  mine: number
  act: number
  /** Issues with something unacknowledged, yours or not. */
  fresh: number
}

export function attentionOf(entry: Tracked): Attention {
  if (entry.group === 'done') return 'idle'
  if (entry.fresh.length > 0) return entry.mine ? 'act' : 'fresh'

  return 'live'
}

function rowOf(entry: Tracked): Row {
  const attention = attentionOf(entry)
  const last = entry.fresh[entry.fresh.length - 1]
  const issue = entry.issue

  return {
    key: entry.key,
    attention,
    group: entry.group,
    mine: entry.mine,
    status: issue.status,
    type: issue.type,
    priority: issue.priority,
    assignee: issue.assignee ?? '',
    summary: issue.summary,
    reason:
      last !== undefined ? last.text : attention === 'idle' ? `закрыта: ${issue.status}` : issue.status,
    freshCount: entry.fresh.length,
    branch: entry.branch ?? '',
  }
}

export function matches(row: Row, filter: Filter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'progress':
      return row.group === 'progress'
    case 'open':
      return row.group === 'open'
    case 'mine':
      return row.mine && row.group !== 'done'
    case 'fresh':
      return row.freshCount > 0
    case 'done':
      return row.group === 'done'
  }
}

/** Newest update first inside a group, the order Jira itself uses. */
export function overviewOf(list: readonly Tracked[], filter: Filter = 'all'): Overview {
  const stamp = new Map(list.map(entry => [entry.key, parseTime(entry.issue.updated)]))
  const all = list.map(rowOf)
  const rows = ORDER.flatMap(group =>
    all
      .filter(row => row.attention === group && matches(row, filter))
      .sort((left, right) => (stamp.get(right.key) ?? 0) - (stamp.get(left.key) ?? 0)),
  )
  const count = (test: (row: Row) => boolean) => all.filter(test).length

  return {
    rows,
    total: all.length,
    progress: count(row => row.group === 'progress'),
    open: count(row => row.group === 'open'),
    done: count(row => row.group === 'done'),
    mine: count(row => row.mine && row.group !== 'done'),
    act: count(row => row.attention === 'act'),
    fresh: count(row => row.freshCount > 0),
  }
}
