// What `/pr` was asked to do, read off its argument string. It depends on
// nothing, so the command's grammar is settled by tests and not by trying
// words in a session; resolving `text` into a pull request is the caller's job.

import type { Scope } from './scope.ts'

export type Action =
  /** `/pr` - open the pane, or close it when it is open. */
  | { kind: 'toggle' }
  /** `/pr list` - показать общий список наблюдения. */
  | { kind: 'list' }
  /**
   * `/pr repo owner/repo` - назвать репозиторий руками; пустой текст -
   * показать, какой репозиторий выбран сейчас и откуда он взялся.
   */
  | { kind: 'repo'; text: string }
  /** `/pr open | week | branch` - какие PR мод берёт под наблюдение сам. */
  | { kind: 'scope'; scope: Scope }
  /** `/pr next`, `/pr prev` - соседний PR в порядке списка, детали открываются на нём. */
  | { kind: 'step'; delta: 1 | -1 }
  /** `/pr review [123]` - отдать PR на ревью: выбранный либо названный номером. */
  | { kind: 'review'; number: number | null }
  /**
   * `/pr fix [all | 3]` - отдать тредам выбранного PR агента-фиксера: все
   * открытые либо один по номеру из `/pr threads`.
   */
  | { kind: 'fix'; target: 'all' | number }
  /** `/pr threads` - print the open threads into the transcript. */
  | { kind: 'threads' }
  /** `/pr status` - print the pull request's facts into the transcript. */
  | { kind: 'status' }
  /** `/pr checks` - print the checks of the head commit into the transcript. */
  | { kind: 'checks' }
  /** `/pr refresh` - poll now instead of at the next tick. */
  | { kind: 'refresh' }
  /** `/pr drop [number | all]` - stop watching. */
  | { kind: 'drop'; target: 'all' | 'selected' | number }
  /** `/pr 123` or `/pr <url>` - watch that one and show it. */
  | { kind: 'watch'; number: number | null; text: string }
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
  review: { kind: 'review', number: null },
  fix: { kind: 'fix', target: 'all' },
  threads: { kind: 'threads' },
  status: { kind: 'status' },
  checks: { kind: 'checks' },
  ci: { kind: 'checks' },
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

  const review = /^review\s+#?(\d+)$/.exec(word)

  if (review) return { kind: 'review', number: Number(review[1]) }

  const fix = /^fix\s+(all|\d+)$/.exec(word)

  if (fix) {
    const target = fix[1] ?? ''

    return { kind: 'fix', target: target === 'all' ? 'all' : Number(target) }
  }

  // Аргумент берётся из исходного текста, а не из приведённого к нижнему
  // регистру: имя владельца и репозитория регистрозависимо.
  const repo = /^(?:repo|repository)(?:\s+(.+))?$/i.exec(text)

  if (repo) return { kind: 'repo', text: (repo[1] ?? '').trim() }

  const number = /^#?(\d+)$/.exec(text)

  if (number) return { kind: 'watch', number: Number(number[1]), text }

  if (/\/pull\/\d+/.test(text)) return { kind: 'watch', number: null, text }

  return { kind: 'help' }
}

export const HELP_TEXT = [
  '`/pr` - открыть или закрыть панель: общий список, когда PR несколько, иначе детали.',
  '`/pr list` - общий список наблюдения с итогом; из деталей `/pr` без слова возвращает к списку, из списка закрывает панель.',
  '`/pr next`, `/pr prev` - соседний PR в порядке списка.',
  '`/pr open` - наблюдать все открытые PR репозитория; `/pr week` - все, что двигались за неделю; `/pr branch` - только PR текущей ветки.',
  '`/pr 123` или `/pr <ссылка>` - добавить PR к отслеживанию и показать его.',
  '`/pr review [123]` - отдать PR на ревью (выбранный либо названный номером).',
  '`/pr fix [all | 3]` - отдать открытые треды выбранного PR агенту-фиксеру: все либо один по номеру из `/pr threads`.',
  '`/pr threads` - выписать открытые треды текстом (их читает модель).',
  '`/pr status` - выписать состояние PR текстом.',
  '`/pr checks` - выписать проверки головного коммита.',
  '`/pr refresh` - опросить GitHub сейчас.',
  '`/pr drop [123 | all]` - снять с отслеживания.',
  '`/pr repo owner/repo` - назвать репозиторий руками; `/pr repo` - показать выбранный.',
].join('\n')
