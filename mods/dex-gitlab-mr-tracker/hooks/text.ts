// The mod's texts: what a slash command prints into the transcript, and what
// the threads ride into the next prompt as. Both are read by the model, so
// they carry the address of every thread (file, line, author, link) and no
// decoration the model would have to parse past.

import type { MrData } from './gitlab.ts'
import { ATTENTION_MANY, ATTENTION_ONE, overviewOf, reasonOf } from './overview.ts'
import { approvalsGiven, threadTally } from './gitlab.ts'
import type { Watched } from './watched.ts'
import { openThreadsOf, plainThreadsOf, resolvedThreadsOf } from './watched.ts'

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

  return `${given}${quota}${by}`
}

/** The MR as one block of transcript text: the same facts the line carries. */
export function statusText(watched: Watched): string {
  const data = watched.data

  if (!data) {
    return `**${watched.label}** - ${watched.error ?? 'данных ещё нет'}`
  }

  const tally = threadTally(data.threads)
  const plain = plainThreadsOf(data).length

  // Один факт - одна строка: сплошную строку через разделители глазом не
  // разобрать, а модель читает список ровно так же.
  const rows: Array<[string, string | null]> = [
    ['Состояние', stateWord(data)],
    ['Ветки', `${data.sourceBranch} -> ${data.targetBranch}`],
    ['Автор', data.author],
    ['Merge', data.hasConflicts ? `${data.mergeStatus}, есть конфликты` : data.mergeStatus],
    ['Пайплайн', pipelineWord(data)],
    ['Апрувы', approvalsWord(data)],
    ['Треды', `${tally.open} открытых из ${tally.resolvable}`],
    ['Обсуждения без резолва', plain > 0 ? String(plain) : null],
    ['Комментарии', String(data.notesCount)],
    ['Коммиты', `${data.commits.length}${data.commitsCapped ? '+' : ''}`],
    ['Файлов изменено', data.changesCount === '' ? null : data.changesCount],
    ['Ревьюеры', data.reviewers.length > 0 ? data.reviewers.join(', ') : null],
    ['Метки', data.labels.length > 0 ? data.labels.join(', ') : null],
    ['Ссылка', data.webUrl],
    ['Последний опрос', watched.error === undefined ? null : `не удался: ${watched.error}`],
  ]

  const listed = rows
    .filter((row): row is [string, string] => row[1] !== null)
    .map(([name, value]) => `- ${name}: ${value}`)

  return [`**${watched.label}** - ${data.title}`, '', ...listed].join('\n')
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

  const head = [
    `**Открытые треды ${watched.label}** - ${open.length} из ${threadTally(data.threads).resolvable}`,
    data.webUrl,
    '',
  ].join('\n')

  const lines: string[] = [head]
  let length = head.length
  let shown = 0

  for (const thread of open) {
    const where =
      thread.file === null
        ? 'обсуждение MR'
        : `${thread.file}${thread.line === null ? '' : `:${thread.line}`}`

    // Каждый тред - свой блок с пустой строкой после: адрес, кто и сколько,
    // само замечание, ссылка. Сплошной список слипается и глазом, и в разборе.
    const entry = [
      `- **${where}**`,
      `  ${thread.author}, комментариев ${thread.notes}, последний от ${thread.lastAuthor}`,
      `  ${thread.body}`,
      `  ${thread.url}`,
      '',
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

/**
 * Общий список наблюдения текстом: итог и по строке на MR с причиной и
 * ссылкой. Это текстовый дубль панели-списка - без него список был бы виден
 * человеку и невидим модели.
 */
export function overviewText(list: readonly Watched[]): string {
  const overview = overviewOf(list)

  if (overview.total === 0) return 'Ни один merge request не отслеживается.'

  const counts: string[] = []

  if (overview.act > 0) counts.push(`${overview.act} ${ATTENTION_MANY.act}`)
  if (overview.wait > 0) counts.push(`${overview.wait} ${ATTENTION_MANY.wait}`)
  if (overview.unknown > 0) counts.push(`${overview.unknown} ${ATTENTION_MANY.unknown}`)
  if (overview.idle > 0) counts.push(`${overview.idle} ${ATTENTION_MANY.idle}`)
  if (overview.threadsOpen > 0) counts.push(`${overview.threadsOpen} открытых тредов`)
  if (overview.failed > 0) counts.push(`опрос не удался у ${overview.failed}`)

  const head = `**Мониторинг merge request** - ${overview.total}: ${counts.join(', ')}`
  const rows = overview.rows.map(row => {
    const reason = reasonOf(row)
    const title = row.title === '' ? '' : ` - ${row.title}`
    const where = row.webUrl === '' ? '' : `\n  ${row.webUrl}`

    return `- **${row.label}** (${ATTENTION_ONE[row.attention]}): ${reason}${title}${where}`
  })

  return [head, '', ...rows].join('\n')
}
