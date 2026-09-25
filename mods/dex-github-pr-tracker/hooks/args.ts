// What `/pr` was asked to do, read off its argument string. It depends on
// nothing, so the command's grammar is settled by tests and not by trying
// words in a session; resolving `text` into a pull request is the caller's job.

export type Action =
  /** `/pr` - open the pane, or close it when it is open. */
  | { kind: 'toggle' }
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

  const number = /^#?(\d+)$/.exec(text)

  if (number) return { kind: 'watch', number: Number(number[1]), text }

  if (/\/pull\/\d+/.test(text)) return { kind: 'watch', number: null, text }

  return { kind: 'help' }
}

export const HELP_TEXT = [
  '`/pr` - открыть или закрыть панель pull request.',
  '`/pr 123` или `/pr <ссылка>` - добавить PR к отслеживанию и показать его.',
  '`/pr threads` - выписать открытые треды текстом (их читает модель).',
  '`/pr status` - выписать состояние PR текстом.',
  '`/pr checks` - выписать проверки головного коммита.',
  '`/pr refresh` - опросить GitHub сейчас.',
  '`/pr drop [123 | all]` - снять с отслеживания.',
].join('\n')
