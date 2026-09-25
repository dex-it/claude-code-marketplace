// Общий список наблюдения: несколько pull request, сведённые в перечень со
// своим состоянием у каждого и одним итогом сверху. Отвечает на один вопрос -
// «что из этого ждёт меня», - и в этом отличается от панели одного PR, которая
// отвечает «что именно там».
//
// Модуль чистый: ни `$`, ни сети. Порядок строк и правило внимания решаются
// здесь, потому что это суждение о предмете, а не об отрисовке, и проверяются
// прогоном.

import type { CheckLevel, MergeLevel, PrData } from './github.ts'
import { decisionWord, mergeLevel, threadTally } from './github.ts'
import type { Watched } from './watched.ts'

/**
 * Что делать со строкой списка.
 *
 * `act` - ждёт вас: конфликт, красная обязательная проверка, просьба о
 * правках, открытые треды. `wait` - штатный гейт ещё не пройден, делать
 * нечего. `idle` - делать нечего и не будет: PR закрыт, смержен или черновик.
 * `unknown` - данных нет вовсе: первый опрос ещё идёт либо не прошёл.
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
  /** `open`, `draft`, `merged`, `closed`; пусто без данных. */
  state: string
  /** `mergeStateStatus` в нижнем регистре; пусто без данных. */
  merge: string
  mergeLevel: MergeLevel
  /** Исход обязательных проверок; null - проверок нет или данных ещё нет. */
  ci: string | null
  ciLevel: CheckLevel | null
  threadsOpen: number
  threadsTotal: number
  /** Вердикт ревью словами и апрувы; null - сказать нечего. */
  review: string | null
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
  /** Сумма открытых тредов по всем PR: столько замечаний ждёт ответа. */
  threadsOpen: number
  /** У скольких PR последний опрос не прошёл. */
  failed: number
  /** Сколько инстансов GitHub в списке: больше одного - хост нужен в строке. */
  hosts: number
}

const stateWord = (data: PrData) =>
  data.state === 'OPEN' && data.draft ? 'draft' : data.state.toLowerCase()

const reviewWord = (data: PrData) => {
  const reviews = data.reviews
  const word = decisionWord(reviews.decision)

  // Репозиторий без правила обязательного ревью отдаёт `reviewDecision` null.
  // Тогда строка про ревью - шум, а не факт, пока никто не высказался.
  if (word === null && reviews.approved.length === 0 && reviews.changesRequested.length === 0) {
    return null
  }

  const given = reviews.approved.length

  return given === 0 ? (word ?? 'ревью не требуется') : `${word ?? 'апрувы'}, ${given}`
}

/**
 * Причина, по которой PR ждёт человека, и группа внимания. Порядок проверок -
 * порядок работы: конфликт держит всё, красная обязательная проверка держит
 * мерж, просьба о правках - названный вердикт, треды - её подробности. Первая
 * сработавшая и становится причиной: строка списка одна, и перечислять в ней
 * всё сразу значит не сказать ничего.
 */
function judge(data: PrData): { attention: Attention; why: string | null } {
  // Закрытый или смерженный PR не ждёт ничего, что бы в нём ни осталось.
  if (data.state !== 'OPEN') return { attention: 'idle', why: null }

  const merge = mergeLevel(data.mergeStatus)
  const status = data.mergeStatus.toLowerCase()

  if (merge === 'bad') return { attention: 'act', why: status }

  if (data.checks?.level === 'bad') {
    return { attention: 'act', why: `проверки: ${data.checks.word}` }
  }

  if (data.reviews.decision === 'CHANGES_REQUESTED') {
    return { attention: 'act', why: 'нужны правки' }
  }

  const open = threadTally(data.threads).open

  if (open > 0) return { attention: 'act', why: `${open} открытых тредов` }

  // Draft проверяется после причин: черновик с конфликтом или красной
  // проверкой всё равно ждёт автора, а вот черновик без них не ждёт никого.
  if (data.draft) return { attention: 'idle', why: null }

  return { attention: 'wait', why: merge === 'wait' ? status : null }
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
      threadsTotal: 0,
      review: null,
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
    merge: data.mergeStatus.toLowerCase(),
    mergeLevel: mergeLevel(data.mergeStatus),
    ci: data.checks?.word ?? null,
    ciLevel: data.checks?.level ?? null,
    threadsOpen: tally.open,
    threadsTotal: tally.total,
    review: reviewWord(data),
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
