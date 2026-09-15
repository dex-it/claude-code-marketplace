// The mod's texts: what a slash command prints into the transcript, and what
// the threads ride into the next prompt as. Both are read by the model, so
// they carry the address of every thread (file, line, author, link) and no
// decoration the model would have to parse past.

import type { MrData } from './gitlab'
import { approvalsGiven, threadTally } from './gitlab'
import type { Watched } from './watched'
import { openThreadsOf, plainThreadsOf, resolvedThreadsOf } from './watched'

/** What the threads text may take of a prompt before it is cut. */
export const THREADS_TEXT_MAX_CHARS = 8000

const stateWord = (data: MrData) =>
  data.state === 'opened' && data.draft ? 'draft' : data.state

const pipelineWord = (data: MrData) => data.pipeline?.status ?? 'нет пайплайна'

const approvalsWord = (data: MrData) => {
  const approvals = data.approvals

  // An instance with no approval rule and nobody having approved has nothing
  // to say here; `апрувы 0` on every MR would be noise, not a fact.
  if (!approvals || (approvals.required === null && approvals.by.length === 0)) return null

  const given = approvalsGiven(approvals)
  const quota = approvals.required === null ? '' : `/${approvals.required}`
  const by = approvals.by.length > 0 ? ` (${approvals.by.join(', ')})` : ''

  return `апрувы ${given}${quota}${by}`
}

/** The MR as one block of transcript text: the same facts the line carries. */
export function statusText(watched: Watched): string {
  const data = watched.data

  if (!data) {
    return `**${watched.label}** - ${watched.error ?? 'данных ещё нет'}`
  }

  const tally = threadTally(data.threads)
  const plain = plainThreadsOf(data).length

  const head = [
    `**${watched.label}** ${stateWord(data)} - ${data.title}`,
    `${data.webUrl}`,
    `${data.sourceBranch} -> ${data.targetBranch}, автор ${data.author}`,
  ]

  const facts = [
    `merge: ${data.mergeStatus}`,
    `пайплайн: ${pipelineWord(data)}`,
    approvalsWord(data),
    data.hasConflicts ? 'конфликты' : null,
  ].filter((fact): fact is string => fact !== null)

  const counts = [
    `треды: ${tally.open} открытых из ${tally.resolvable}`,
    plain > 0 ? `обсуждений без резолва: ${plain}` : null,
    `комментариев: ${data.notesCount}`,
    `коммитов: ${data.commits.length}${data.commitsCapped ? '+' : ''}`,
    data.changesCount === '' ? null : `изменено файлов: ${data.changesCount}`,
  ].filter((count): count is string => count !== null)

  const meta = [
    data.reviewers.length > 0 ? `ревьюеры: ${data.reviewers.join(', ')}` : null,
    data.labels.length > 0 ? `метки: ${data.labels.join(', ')}` : null,
    watched.error === undefined ? null : `последний опрос не удался: ${watched.error}`,
  ].filter((entry): entry is string => entry !== null)

  return [...head, facts.join(' - '), counts.join(' - '), ...meta].join('\n')
}

/**
 * The open threads as a task list: one entry per thread, addressed by file
 * and line so the reader can open it without another call.
 */
export function threadsText(watched: Watched, max = THREADS_TEXT_MAX_CHARS): string {
  const data = watched.data

  if (!data) return `${watched.label}: данных ещё нет`

  const open = openThreadsOf(data)

  if (open.length === 0) {
    const resolved = resolvedThreadsOf(data).length

    return `${watched.label}: открытых тредов нет${resolved > 0 ? ` (закрыто ${resolved})` : ''}`
  }

  const head = `Открытые треды ${watched.label} (${open.length} из ${threadTally(data.threads).resolvable}), ${data.webUrl}`
  const lines: string[] = [head]
  let length = head.length
  let shown = 0

  for (const thread of open) {
    const where =
      thread.file === null
        ? 'обсуждение MR'
        : `${thread.file}${thread.line === null ? '' : `:${thread.line}`}`

    const entry = [
      `- ${where} - ${thread.author}, комментариев ${thread.notes}, последний от ${thread.lastAuthor}`,
      `  ${thread.body}`,
      `  ${thread.url}`,
    ].join('\n')

    if (length + entry.length + 1 > max) break

    lines.push(entry)
    length += entry.length + 1
    shown += 1
  }

  if (shown < open.length) lines.push(`- ... ещё ${open.length - shown} тредов, см. ${data.webUrl}`)

  return lines.join('\n')
}

/** The one-line answer `/mr` prints when it has nothing to draw a pane for. */
export const noMrText =
  'MR не найден: откройте merge request для текущей ветки, ' +
  'или назовите его - `/mr 123`, `/mr <ссылка>`.'
