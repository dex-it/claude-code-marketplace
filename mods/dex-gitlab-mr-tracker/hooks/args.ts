// What `/mr` was asked to do, read off its argument string. It depends on
// nothing, so the command's grammar is settled by tests and not by trying
// words in a session; resolving `text` into an MR is the caller's job.

import type { Scope } from './scope.ts'

export type Action =
  /** `/mr` - open the pane, or close it when it is open. */
  | { kind: 'toggle' }
  /** `/mr list` - показать общий список наблюдения. */
  | { kind: 'list' }
  /**
   * `/mr repo group/proj` - назвать проект руками; пустой текст - показать,
   * какой проект выбран сейчас и откуда он взялся.
   */
  | { kind: 'repo'; text: string }
  /** `/mr open | week | branch` - какие MR мод берёт под наблюдение сам. */
  | { kind: 'scope'; scope: Scope }
  /** `/mr next`, `/mr prev` - соседний MR в порядке списка, детали открываются на нём. */
  | { kind: 'step'; delta: 1 | -1 }
  /** `/mr review [123]` - отдать MR на ревью: выбранный либо названный номером. */
  | { kind: 'review'; iid: number | null }
  /**
   * `/mr fix [all | 3]` - отдать треды выбранного MR агенту-фиксеру: все
   * открытые либо один по номеру из `/mr threads`.
   */
  | { kind: 'fix'; target: 'all' | number }
  /** `/mr threads` - print the open threads into the transcript. */
  | { kind: 'threads' }
  /** `/mr status` - print the MR's facts into the transcript. */
  | { kind: 'status' }
  /** `/mr refresh` - poll now instead of at the next tick. */
  | { kind: 'refresh' }
  /** `/mr drop [iid | all]` - stop watching. */
  | { kind: 'drop'; target: 'all' | 'selected' | number }
  /** `/mr 123` or `/mr <url>` - watch that one and show it. */
  | { kind: 'watch'; iid: number | null; text: string }
  | { kind: 'help' }

const WORDS: Record<string, Action> = {
  '': { kind: 'toggle' },
  list: { kind: 'list' },
  ls: { kind: 'list' },
  open: { kind: 'scope', scope: 'open' },
  week: { kind: 'scope', scope: 'week' },
  branch: { kind: 'scope', scope: 'branch' },
  next: { kind: 'step', delta: 1 },
  prev: { kind: 'step', delta: -1 },
  review: { kind: 'review', iid: null },
  fix: { kind: 'fix', target: 'all' },
  threads: { kind: 'threads' },
  status: { kind: 'status' },
  refresh: { kind: 'refresh' },
  help: { kind: 'help' },
  '?': { kind: 'help' },
}

const STOP_WORDS = new Set(['drop', 'off', 'stop'])

export function parseArgs(raw: string): Action {
  const text = raw.trim()
  const word = text.toLowerCase()
  const known = WORDS[word]

  if (known) return known

  if (STOP_WORDS.has(word)) return { kind: 'drop', target: 'selected' }

  const drop = /^(?:drop|off|stop)\s+(all|\d+)$/.exec(word)

  if (drop) {
    const target = drop[1] ?? ''

    return { kind: 'drop', target: target === 'all' ? 'all' : Number(target) }
  }

  const review = /^review\s+!?#?(\d+)$/.exec(word)

  if (review) return { kind: 'review', iid: Number(review[1]) }

  const fix = /^fix\s+(all|\d+)$/.exec(word)

  if (fix) {
    const target = fix[1] ?? ''

    return { kind: 'fix', target: target === 'all' ? 'all' : Number(target) }
  }

  // Аргумент берётся из исходного текста, а не из приведённого к нижнему
  // регистру: путь проекта GitLab регистрозависим.
  const repo = /^(?:repo|project)(?:\s+(.+))?$/i.exec(text)

  if (repo) return { kind: 'repo', text: (repo[1] ?? '').trim() }

  const iid = /^!?(\d+)$/.exec(text)

  if (iid) return { kind: 'watch', iid: Number(iid[1]), text }

  if (/\/-\/merge_requests\/\d+/.test(text)) return { kind: 'watch', iid: null, text }

  return { kind: 'help' }
}

export const HELP_TEXT = [
  '`/mr` - открыть или закрыть панель: общий список, когда MR несколько, иначе детали.',
  '`/mr list` - общий список наблюдения с итогом; из деталей `/mr` без слова возвращает к списку, из списка закрывает панель.',
  '`/mr next`, `/mr prev` - соседний MR в порядке списка.',
  '`/mr open` - наблюдать все открытые MR проекта; `/mr week` - все, что двигались за неделю; `/mr branch` - только MR текущей ветки.',
  '`/mr 123` или `/mr <ссылка>` - добавить MR к отслеживанию и показать его.',
  '`/mr review [123]` - отдать MR на ревью (выбранный либо названный номером).',
  '`/mr fix [all | 3]` - отдать открытые треды выбранного MR агенту-фиксеру: все либо один по номеру из `/mr threads`.',
  '`/mr threads` - выписать открытые треды текстом (их читает модель).',
  '`/mr status` - выписать состояние MR текстом.',
  '`/mr refresh` - опросить GitLab сейчас.',
  '`/mr drop [123 | all]` - снять с отслеживания.',
  '`/mr repo group/proj` - назвать проект руками; `/mr repo` - показать выбранный.',
].join('\n')
