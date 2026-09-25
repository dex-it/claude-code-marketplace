// The mod's texts: what a slash command prints into the transcript, and what
// the threads ride into the next prompt as. Both are read by the model, so
// they carry the address of every thread (file, line, author, link) and no
// decoration the model would have to parse past.

import type { PrData } from './github.ts'
import { decisionWord, threadTally } from './github.ts'
import type { Watched } from './watched.ts'
import { openThreadsOf, resolvedThreadsOf } from './watched.ts'

/** What the threads text may take of a prompt before it is cut. */
export const THREADS_TEXT_MAX_CHARS = 8000

const stateWord = (data: PrData) =>
  data.state === 'OPEN' && data.draft ? 'draft' : data.state.toLowerCase()

const checksWord = (data: PrData) => {
  const checks = data.checks

  if (!checks) return null

  const scope =
    checks.required === 0
      ? `${checks.total}, обязательных нет`
      : `обязательных ${checks.required} из ${checks.total}`
  const bad = checks.bad.length === 0 ? '' : `, не зелёных ${checks.bad.length}`

  return `${checks.word} (${scope})${bad}`
}

const reviewWord = (data: PrData) => {
  const reviews = data.reviews
  const word = decisionWord(reviews.decision)

  // Репозиторий без правила обязательного ревью отдаёт `reviewDecision` null.
  // Тогда «ревью: не требуется» на каждом PR - шум, а не факт; строка
  // появляется только там, где кто-то уже высказался.
  if (word === null && reviews.approved.length === 0 && reviews.changesRequested.length === 0) {
    return null
  }

  const parts = [word ?? 'ревью не требуется']

  if (reviews.approved.length > 0) parts.push(`апрувы: ${reviews.approved.join(', ')}`)

  if (reviews.changesRequested.length > 0) {
    parts.push(`правки просят: ${reviews.changesRequested.join(', ')}`)
  }

  return parts.join('; ')
}

const mergeWord = (data: PrData) => {
  // В нижнем регистре, как в строке над вводом: один и тот же факт не должен
  // выглядеть двумя разными словами в панели и в тексте для модели.
  const status = data.mergeStatus.toLowerCase()

  return data.mergeable === 'CONFLICTING'
    ? `${status}, есть конфликты`
    : data.mergeable === 'UNKNOWN'
      ? `${status}, слияние ещё считается`
      : status
}

/** The PR as one block of transcript text: the same facts the line carries. */
export function statusText(watched: Watched): string {
  const data = watched.data

  if (!data) {
    return `**${watched.label}** - ${watched.error ?? 'данных ещё нет'}`
  }

  const tally = threadTally(data.threads)

  // Один факт - одна строка: сплошную строку через разделители глазом не
  // разобрать, а модель читает список ровно так же.
  const rows: Array<[string, string | null]> = [
    ['Состояние', stateWord(data)],
    ['Ветки', `${data.headRefName} -> ${data.baseRefName}`],
    ['Автор', data.author],
    ['Merge', mergeWord(data)],
    ['Проверки', checksWord(data)],
    ['Ревью', reviewWord(data)],
    ['Треды', `${tally.open} открытых из ${tally.total}`],
    ['Комментарии в обсуждении', String(data.comments)],
    ['Коммиты', String(data.commitsTotal)],
    ['Объём', `+${data.additions} -${data.deletions} в ${data.changedFiles} файлах`],
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
    `**Открытые треды ${watched.label}** - ${open.length} из ${data.threads.length}`,
    data.webUrl,
    '',
  ].join('\n')

  const lines: string[] = [head]
  let length = head.length
  let shown = 0

  for (const thread of open) {
    const where =
      thread.file === null
        ? 'обсуждение кода'
        : `${thread.file}${thread.line === null ? '' : `:${thread.line}`}`

    // Каждый тред - свой блок с пустой строкой после: адрес, кто и сколько,
    // само замечание, ссылка. Сплошной список слипается и глазом, и в разборе.
    const entry = [
      `- **${where}**${thread.outdated ? ' (строка уехала в новых коммитах)' : ''}`,
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

/**
 * Проверки головного коммита текстом. Отдельная команда, а не строка в
 * состоянии: имён проверок бывает десятки, и в панели они не помещаются, а
 * модели нужно именно имя упавшей и ссылка на её лог.
 */
export function checksText(watched: Watched): string {
  const data = watched.data

  if (!data) return `${watched.label}: данных ещё нет`

  const checks = data.checks

  if (!checks) return `${watched.label}: у головного коммита проверок нет`

  const head = [
    `**Проверки ${watched.label}** - ${checks.word}`,
    `всего ${checks.total}, обязательных ${checks.required}`,
    `роллап GitHub по всем: ${checks.state.toLowerCase()}`,
  ].join(', ')

  if (checks.bad.length === 0) return `${head}\n\nВсе проверки зелёные.`

  const rows = checks.bad.map(check => {
    const url = check.url === '' ? '' : `\n  ${check.url}`
    const kind = check.required ? 'обязательная' : 'необязательная'

    return `- **${check.name}** (${kind}): ${check.word}${url}`
  })

  return [head, '', ...rows].join('\n')
}

/** The one-line answer `/pr` prints when it has nothing to draw a pane for. */
export const noPrText =
  'PR не найден: откройте pull request для текущей ветки, ' +
  'или назовите его - `/pr 123`, `/pr <ссылка>`.'
