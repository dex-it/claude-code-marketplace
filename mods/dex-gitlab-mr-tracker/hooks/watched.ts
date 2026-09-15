// One watched merge request as the session holds it: its address, the last
// answer, and whether the mod found it itself from the branch or the person
// asked for it by hand.

import type { MrData, MrRef } from './gitlab'
import { keyOf, labelOf, paneIdOf } from './gitlab'

export type Watched = {
  ref: MrRef
  key: string
  label: string
  pane: string
  /** Found from the current branch; a branch switch drops it, a manual one stays. */
  auto: boolean
  data?: MrData
  /** Why the last poll failed; the previous data stays on screen beside it. */
  error?: string
  busy: boolean
  updatedMs: number
}

export const watchedOf = (ref: MrRef, auto: boolean): Watched => ({
  ref,
  key: keyOf(ref),
  label: labelOf(ref),
  pane: paneIdOf(ref),
  auto,
  busy: false,
  updatedMs: 0,
})

/** Open threads first, oldest last comment first: what to answer next. */
export const openThreadsOf = (data: MrData) =>
  data.threads
    .filter(thread => thread.resolvable && !thread.resolved)
    .sort((left, right) => left.lastAt.localeCompare(right.lastAt))

export const resolvedThreadsOf = (data: MrData) =>
  data.threads.filter(thread => thread.resolvable && thread.resolved)

/** Threads GitLab does not let anyone resolve: plain discussion of the MR. */
export const plainThreadsOf = (data: MrData) =>
  data.threads.filter(thread => !thread.resolvable)
