// Общий список наблюдения: несколько merge request, сведённые в перечень со
// своим состоянием у каждого и одним итогом сверху. Отвечает на один вопрос -
// «что из этого ждёт меня», - и в этом отличается от панели одного MR, которая
// отвечает «что именно там».
//
// Модуль чистый: ни `$`, ни сети. Порядок строк и правило внимания решаются
// здесь, потому что это суждение о предмете, а не об отрисовке, и проверяются
// прогоном.

import type { CiLevel, MergeLevel, MrData } from './gitlab.ts'
import { approvalsGiven, mergeLevel, pipelineLevel, threadTally } from './gitlab.ts'
import type { Watched } from './watched.ts'

/**
 * Что делать со строкой списка.
 *
 * `act` - ждёт вас: конфликт, красный пайплайн, открытые треды. `wait` -
 * штатный гейт ещё не пройден, делать нечего. `idle` - делать нечего и не
 * будет: MR закрыт, смержен или переведён в draft. `unknown` - данных нет
 * вовсе: первый опрос ещё идёт либо не прошёл.
 */
export type Attention = 'act' | 'wait' | 'unknown' | 'idle'

/** Порядок групп в списке: сначала то, что ждёт человека. */
const ORDER: readonly Attention[] = ['act', 'wait', 'unknown', 'idle']

/**
 * Как группа называется словами. Две формы, потому что итог считает («2 ждут
 * вас»), а строка называет одну («ждёт вас»); дом у обеих один, иначе строка и
 * итог разошлись бы в словах об одном и том же.
 */
export const ATTENTION_ONE: Record<Attention, string> = {
  act: 'ждёт вас',
  wait: 'ждёт гейта',
  unknown: 'данных нет',
  idle: 'не ждёт',
}

export const ATTENTION_MANY: Record<Attention, string> = {
  act: 'ждут вас',
  wait: 'ждут гейта',
  unknown: 'без данных',
  idle: 'не ждут',
}

export type Row = {
  key: string
  label: string
  /** Хост: в списке он нужен только когда наблюдаются разные инстансы. */
  host: string
  attention: Attention
  /** Пусто, пока данных нет. */
  title: string
  webUrl: string
  /** `opened`, `draft`, `merged`, `closed`; пусто без данных. */
  state: string
  /** `detailed_merge_status` как его отдал инстанс; пусто без данных. */
  merge: string
  mergeLevel: MergeLevel
  /** Статус пайплайна; null - пайплайна нет или данных ещё нет. */
  ci: string | null
  ciLevel: CiLevel | null
  threadsOpen: number
  threadsResolvable: number
  /** Апрувы строкой `1/2`; null - инстанс о них молчит и квоты никто не ставил. */
  approvals: string | null
  /**
   * Почему строка ждёт человека - одна причина, самая сильная из сработавших.
   * null у всего, что его не ждёт.
   */
  why: string | null
  /** Последний опрос не прошёл; прежние факты в строке остаются. */
  error: string | null
}

export type Overview = {
  /** Отсортированы по группе внимания; внутри группы - порядок добавления. */
  rows: readonly Row[]
  total: number
  act: number
  wait: number
  idle: number
  unknown: number
  /** Сумма открытых тредов по всем MR: столько замечаний ждёт ответа. */
  threadsOpen: number
  /** У скольких MR последний опрос не прошёл. */
  failed: number
  /** Сколько инстансов GitLab в списке: больше одного - хост нужен в строке. */
  hosts: number
}

const stateWord = (data: MrData) =>
  data.state === 'opened' && data.draft ? 'draft' : data.state

const approvalsWord = (data: MrData) => {
  const approvals = data.approvals

  // Инстанс без правил апрувов, где никто не апрувил, о них молчит: `0/0` на
  // каждом MR был бы шумом, а не фактом.
  if (!approvals || (approvals.required === null && approvals.by.length === 0)) return null

  const given = approvalsGiven(approvals)

  return approvals.required === null ? String(given) : `${given}/${approvals.required}`
}

/**
 * Причина, по которой MR ждёт человека, и группа внимания. Порядок проверок -
 * порядок работы: конфликт держит всё, красный пайплайн держит мерж, треды
 * ждут ответа. Первая сработавшая и становится причиной: строка списка одна, и
 * перечислять в ней всё сразу значит не сказать ничего.
 */
function judge(data: MrData): { attention: Attention; why: string | null } {
  // Закрытый или смерженный MR не ждёт ничего, что бы в нём ни осталось.
  if (data.state !== 'opened') return { attention: 'idle', why: null }

  const merge = mergeLevel(data.mergeStatus)

  if (merge === 'bad') return { attention: 'act', why: data.mergeStatus }

  const ci = data.pipeline === null ? null : pipelineLevel(data.pipeline.status)

  if (ci === 'bad') return { attention: 'act', why: `пайплайн: ${data.pipeline?.status ?? ''}` }

  const open = threadTally(data.threads).open

  if (open > 0) {
    return { attention: 'act', why: `${open} открытых тредов` }
  }

  // Draft проверяется после причин: черновик с конфликтом или красным
  // пайплайном всё равно ждёт автора, а вот черновик без них не ждёт никого.
  if (data.draft) return { attention: 'idle', why: null }

  return { attention: 'wait', why: merge === 'wait' ? data.mergeStatus : null }
}

function rowOf(entry: Watched): Row {
  const data = entry.data
  const error = entry.error ?? null

  if (!data) {
    return {
      key: entry.key,
      label: entry.label,
      host: entry.ref.host,
      attention: 'unknown',
      title: '',
      webUrl: '',
      state: '',
      merge: '',
      mergeLevel: 'wait',
      ci: null,
      ciLevel: null,
      threadsOpen: 0,
      threadsResolvable: 0,
      approvals: null,
      // Пустой причины у строки не бывает: пока опрос идёт, так и сказано.
      why: error ?? 'первый опрос идёт',
      error,
    }
  }

  const tally = threadTally(data.threads)
  const verdict = judge(data)

  return {
    key: entry.key,
    label: entry.label,
    host: entry.ref.host,
    attention: verdict.attention,
    title: data.title,
    webUrl: data.webUrl,
    state: stateWord(data),
    merge: data.mergeStatus,
    mergeLevel: mergeLevel(data.mergeStatus),
    ci: data.pipeline?.status ?? null,
    ciLevel: data.pipeline === null ? null : pipelineLevel(data.pipeline.status),
    threadsOpen: tally.open,
    threadsResolvable: tally.resolvable,
    approvals: approvalsWord(data),
    why: verdict.why,
    error,
  }
}

/**
 * Что стоит в колонке причины: сама причина, а у строки, которая никого не
 * ждёт, - её состояние. Дом один, потому что колонку рисуют двое - панель и
 * текстовый дубль, - и разойтись в ней они не имеют права.
 *
 * Ветки «причины нет и состояния нет» здесь не бывает: у строки без данных
 * причина всегда названа, хотя бы тем, что первый опрос ещё идёт.
 */
export const reasonOf = (row: Row) =>
  row.why ?? (row.attention === 'idle' ? row.state : row.merge)

/** Весь список наблюдения одним перечнем и одним итогом. */
export function overviewOf(list: readonly Watched[]): Overview {
  const rows = list.map(rowOf)
  const sorted = ORDER.flatMap(group => rows.filter(row => row.attention === group))
  const count = (group: Attention) => rows.filter(row => row.attention === group).length

  return {
    rows: sorted,
    total: rows.length,
    act: count('act'),
    wait: count('wait'),
    idle: count('idle'),
    unknown: count('unknown'),
    threadsOpen: rows.reduce((sum, row) => sum + row.threadsOpen, 0),
    failed: rows.filter(row => row.error !== null).length,
    hosts: new Set(rows.map(row => row.host)).size,
  }
}
