// One watched pull request as the session holds it: its address, the last
// answer, and whether the mod found it itself from the branch or the person
// asked for it by hand.

import type { PrData, PrRef } from './github.ts'
import { keyOf, labelOf } from './github.ts'

export type Watched = {
  ref: PrRef
  key: string
  label: string
  /** Found from the current branch; a branch switch drops it, a manual one stays. */
  auto: boolean
  data?: PrData
  /** Why the last poll failed; the previous data stays on screen beside it. */
  error?: string
  updatedMs: number
}

export const watchedOf = (ref: PrRef, auto: boolean): Watched => ({
  ref,
  key: keyOf(ref),
  label: labelOf(ref),
  auto,
  updatedMs: 0,
})

/** Open threads first, oldest last comment first: what to answer next. */
export const openThreadsOf = (data: PrData) =>
  data.threads
    .filter(thread => !thread.resolved)
    .slice()
    .sort((left, right) => left.lastAt.localeCompare(right.lastAt))

export const resolvedThreadsOf = (data: PrData) =>
  data.threads.filter(thread => thread.resolved)
