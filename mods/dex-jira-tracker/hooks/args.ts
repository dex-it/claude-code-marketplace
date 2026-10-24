// What `/jira` was asked to do, read off its argument string. It depends on
// nothing, so the command's grammar is settled by tests and not by trying
// words in a session; resolving a key or a number into an issue is the caller's job.

import type { Filter } from './overview.ts'
import type { Scope } from './scope.ts'

export type Action =
  /** `/jira` - open the pane, or close it when it is open. */
  | { kind: 'toggle' }
  /** `/jira list` - the whole list into the pane and the transcript. */
  | { kind: 'list' }
  /** `/jira mine | progress | open | new | done | all` - narrow the list. */
  | { kind: 'filter'; filter: Filter }
  /** `/jira next`, `/jira prev` - the neighbouring issue in list order. */
  | { kind: 'step'; delta: 1 | -1 }
  /** `/jira SUP-12`, `/jira 12`, `/jira <link>` - details of that issue. */
  | { kind: 'show'; key: string | null; number: number | null }
  /** `/jira comments [KEY]` - the last comments into the transcript. */
  | { kind: 'comments'; key: string | null }
  /** `/jira seen [KEY | all]` - acknowledge what changed. */
  | { kind: 'seen'; target: 'all' | 'selected' | string }
  | { kind: 'refresh' }
  /** `/jira project KEY` - follow another project; empty text shows the current one. */
  | { kind: 'project'; text: string }
  /** `/jira scope project | mine | sprint | jql` - what is followed. */
  | { kind: 'scope'; scope: Scope }
  /** `/jira jql <query>` - follow a query of one's own. */
  | { kind: 'jql'; text: string }
  /** `/jira spec [KEY | idea]` - write a statement of the task; nothing goes to Jira. */
  | { kind: 'spec'; text: string }
  /** `/jira publish [KEY]` - put the statement from the last answer into Jira. */
  | { kind: 'publish'; key: string | null }
  /** `/jira work [KEY]` - take the issue into work: assign, move, branch, implement. */
  | { kind: 'work'; key: string | null }
  /** `/jira ship [KEY]` - push the branch, open the PR/MR, report it to the issue. */
  | { kind: 'ship'; key: string | null }
  /** `/jira pr` - the PR/MR tracker of the repository's host. */
  | { kind: 'hosting' }
  /** `/jira tools [install [all | role]]` - what is installed, what would be used instead. */
  | { kind: 'tools'; install: string | null }
  | { kind: 'setup' }
  | { kind: 'install' }
  | { kind: 'help' }

const KEY = /^([A-Za-z][A-Za-z0-9_]*-\d+)$/

const WORDS: Record<string, Action> = {
  '': { kind: 'toggle' },
  list: { kind: 'list' },
  ls: { kind: 'list' },
  all: { kind: 'filter', filter: 'all' },
  mine: { kind: 'filter', filter: 'mine' },
  progress: { kind: 'filter', filter: 'progress' },
  open: { kind: 'filter', filter: 'open' },
  new: { kind: 'filter', filter: 'fresh' },
  fresh: { kind: 'filter', filter: 'fresh' },
  done: { kind: 'filter', filter: 'done' },
  next: { kind: 'step', delta: 1 },
  prev: { kind: 'step', delta: -1 },
  comments: { kind: 'comments', key: null },
  seen: { kind: 'seen', target: 'selected' },
  refresh: { kind: 'refresh' },
  spec: { kind: 'spec', text: '' },
  publish: { kind: 'publish', key: null },
  work: { kind: 'work', key: null },
  ship: { kind: 'ship', key: null },
  pr: { kind: 'hosting' },
  mr: { kind: 'hosting' },
  tools: { kind: 'tools', install: null },
  setup: { kind: 'setup' },
  install: { kind: 'install' },
  help: { kind: 'help' },
  '?': { kind: 'help' },
}

/** A key out of a bare key or out of a link into the browser: `.../browse/SUP-12`. */
export function keyOfText(text: string): string | null {
  const bare = KEY.exec(text.trim())

  if (bare) return (bare[1] ?? '').toUpperCase()

  const link = /\/browse\/([A-Za-z][A-Za-z0-9_]*-\d+)/.exec(text)

  return link ? (link[1] ?? '').toUpperCase() : null
}

export function parseArgs(raw: string): Action {
  const text = raw.trim()
  const lower = text.toLowerCase()
  // `hasOwn`: a bare `WORDS['constructor']` would answer with Object's function.
  const known = Object.hasOwn(WORDS, lower) ? WORDS[lower] : undefined

  if (known) return known

  const [head = '', ...rest] = text.split(/\s+/)
  const word = head.toLowerCase()
  const tail = text.slice(head.length).trim()

  // Arguments are read from the original text: a project key and a JQL are case-sensitive.
  if (word === 'project') return { kind: 'project', text: tail }

  if (word === 'jql') return { kind: 'jql', text: tail }

  if (word === 'scope') {
    const scope = (['project', 'mine', 'sprint', 'jql'] as const).find(item => item === tail.toLowerCase())

    return scope === undefined ? { kind: 'help' } : { kind: 'scope', scope }
  }

  if (word === 'spec') return { kind: 'spec', text: tail }

  if (word === 'tools') {
    const [sub, what] = rest.map(part => part.toLowerCase())

    return sub === 'install' ? { kind: 'tools', install: what ?? 'all' } : { kind: 'tools', install: null }
  }

  if (word === 'seen') {
    if (tail.toLowerCase() === 'all') return { kind: 'seen', target: 'all' }

    const key = keyOfText(tail)

    return key === null ? { kind: 'help' } : { kind: 'seen', target: key }
  }

  if (word === 'comments' || word === 'publish' || word === 'work' || word === 'ship') {
    const key = keyOfText(tail)

    if (key === null) return { kind: 'help' }

    return word === 'comments' ? { kind: 'comments', key } : { kind: word, key }
  }

  const key = keyOfText(text)

  if (key !== null) return { kind: 'show', key, number: null }

  const number = /^#?(\d+)$/.exec(text)

  if (number) return { kind: 'show', key: null, number: Number(number[1]) }

  return { kind: 'help' }
}

export const HELP_TEXT = [
  '`/jira` - открыть или закрыть панель: список задач, а на выбранной - детали.',
  '`/jira list` - список в транскрипт и в панель; `/jira mine | progress | open | new | done | all` - сузить его.',
  '`/jira SUP-12`, `/jira 12` или ссылка - детали задачи; `/jira next`, `/jira prev` - соседняя в списке.',
  '`/jira comments [SUP-12]` - последние комментарии текстом (их читает модель); `/jira seen [SUP-12 | all]` - отметить просмотренным.',
  '`/jira spec [SUP-12 | идея]` - написать постановку (команда каталога, если установлена, иначе встроенное поручение); в Jira при этом ничего не пишется.',
  '`/jira publish [SUP-12]` - внести постановку из последнего ответа в Jira: новая задача либо описание/комментарий существующей; только по вашему «оформляй».',
  '`/jira work [SUP-12]` - взять в работу: назначить на себя, перевести в рабочий статус, завести ветку и реализовать.',
  '`/jira ship [SUP-12]` - запушить ветку, открыть PR/MR, сообщить о нём в задачу; `/jira pr` - трекер PR/MR хостинга репозитория.',
  '`/jira project KEY` - следить за другим проектом; `/jira scope project | mine | sprint | jql` и `/jira jql <запрос>` - что именно.',
  '`/jira tools [install [all | роль]]` - какие инструменты каталога подхвачены и чем заменены остальные.',
  '`/jira setup` - как поставить и настроить jira-cli; `/jira install` - поставить его через brew; `/jira refresh` - опросить Jira сейчас.',
].join('\n')
