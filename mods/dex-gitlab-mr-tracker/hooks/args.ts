// What `/mr` was asked to do, read off its argument string. It depends on
// nothing, so the command's grammar is settled by tests and not by trying
// words in a session; resolving `text` into an MR is the caller's job.

export type Action =
  /** `/mr` - open the pane, or close it when it is open. */
  | { kind: 'toggle' }
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

  const iid = /^!?(\d+)$/.exec(text)

  if (iid) return { kind: 'watch', iid: Number(iid[1]), text }

  if (/\/-\/merge_requests\/\d+/.test(text)) return { kind: 'watch', iid: null, text }

  return { kind: 'help' }
}

export const HELP_TEXT = [
  '`/mr` - открыть или закрыть панель merge request.',
  '`/mr 123` или `/mr <ссылка>` - добавить MR к отслеживанию и показать его.',
  '`/mr threads` - выписать открытые треды текстом (их читает модель).',
  '`/mr status` - выписать состояние MR текстом.',
  '`/mr refresh` - опросить GitLab сейчас.',
  '`/mr drop [123 | all]` - снять с отслеживания.',
].join('\n')
