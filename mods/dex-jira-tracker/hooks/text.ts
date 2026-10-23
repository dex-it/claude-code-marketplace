// Everything the pane shows, as text for the transcript and for the model. A
// pane the model cannot see leaves it working blind beside the person, so each
// view has a command that prints the same.
//
// Pure: no `$`, no network.

import { taskText } from './dispatch.ts'
import { clean, firstLine } from './jira.ts'
import type { Filter, Overview, Row } from './overview.ts'
import { ATTENTION_MANY, FILTER_WORD } from './overview.ts'
import type { Tracked } from './watched.ts'

export const noIssuesText =
  'Задач в наблюдении нет. Охват и проект - `/jira scope`, `/jira project`; `/jira refresh` опросит Jira сейчас.'

/** One line per row: key, who it waits on, why, who has it, what it is. */
export function rowText(row: Row): string {
  const mark = row.attention === 'act' ? '!' : row.attention === 'fresh' ? '*' : row.attention === 'idle' ? 'v' : '-'
  const owner = row.mine ? 'вы' : row.assignee === '' ? 'не назначена' : row.assignee
  const branch = row.branch === '' ? '' : ` [${row.branch}]`

  // The reason of a quiet row is its status: saying it twice is noise.
  const who = row.reason === row.status ? owner : `${row.status}; ${owner}`

  return `${mark} ${row.key}  ${row.reason}  (${who})${branch}  ${firstLine(row.summary, 80)}`
}

/** The tally of the list as the words the pane uses. */
export function tallyText(overview: Overview): string {
  const parts = [
    `всего ${overview.total}`,
    `в работе ${overview.progress}`,
    `открытых ${overview.open}`,
    `мои ${overview.mine}`,
  ]

  if (overview.act > 0) parts.push(`${overview.act} ${ATTENTION_MANY.act}`)
  if (overview.fresh > 0) parts.push(`с новым ${overview.fresh}`)
  if (overview.done > 0) parts.push(`${ATTENTION_MANY.idle} ${overview.done}`)

  return parts.join(', ')
}

export function overviewText(
  overview: Overview,
  input: { filter: Filter; scopeWord: string; project: string; truncated: boolean },
): string {
  if (overview.total === 0) return noIssuesText

  const head = `Jira${input.project === '' ? '' : ` ${input.project}`} - ${input.scopeWord}: ${tallyText(overview)}.`
  const shown =
    input.filter === 'all'
      ? ''
      : `Показано: ${FILTER_WORD[input.filter]}, ${overview.rows.length}.`
  const cut = input.truncated
    ? 'Список обрезан лимитом настройки limit: самые свежие по обновлению, остальные не видны.'
    : ''
  const legend = '! ждёт вас, * есть новое, - без изменений, v закрыта.'

  return [head, shown, cut, '', ...overview.rows.map(rowText), '', legend]
    .filter((line, index, all) => line !== '' || all[index - 1] !== '')
    .join('\n')
    .trim()
}

/** One issue: the facts of the task, then what changed since it was last looked at. */
export function issueText(entry: Tracked, url: string): string {
  const sections = [taskText(entry.issue, entry.detail, url)]

  if (entry.fresh.length > 0) {
    sections.push(['Новое с прошлого просмотра:', ...entry.fresh.map(change => `- ${change.text}`)].join('\n'))
  }

  if (entry.branch !== undefined) sections.push(`Ветка: ${entry.branch}`)

  return sections.join('\n\n')
}

export function commentsText(entry: Tracked): string {
  const comments = entry.detail?.comments ?? []

  if (comments.length === 0) {
    return entry.detail === undefined
      ? `${entry.key}: комментарии ещё не загружены.`
      : `${entry.key}: комментариев нет.`
  }

  const total = entry.detail?.total ?? comments.length
  const more = total > comments.length ? ` (показаны последние ${comments.length} из ${total})` : ''

  return [
    `${entry.key}: комментарии${more}`,
    '',
    ...comments.map(
      comment => `${comment.author}, ${comment.created.slice(0, 16).replace('T', ' ')}:\n${clean(comment.text).trim()}`,
    ),
  ].join('\n\n')
}

/** How to get jira-cli going, for each way it can be missing. */
export const SETUP_TEXT = [
  'jira-cli (ankitpokhrel/jira-cli) - единственный источник данных мода.',
  '',
  '1. Установка (любой способ):',
  '   - macOS/Linux: `brew tap ankitpokhrel/jira-cli && brew install jira-cli` (или `/jira install`)',
  '   - Go: `go install github.com/ankitpokhrel/jira-cli/cmd/jira@latest`',
  '   - бинарь релиза: https://github.com/ankitpokhrel/jira-cli/releases',
  '2. Токен в окружении: `JIRA_API_TOKEN`. Jira Cloud - email + API-токен (`JIRA_AUTH_TYPE=basic`, по умолчанию); Server / Data Center - Personal Access Token (`JIRA_AUTH_TYPE=bearer`).',
  '3. Настройка: `jira init` (тип установки, сервер, проект, доска) - пишет `~/.config/.jira/.config.yml`.',
  '4. Проверка: `jira me` назвал вас, `jira issue list` показал задачи. Затем `/jira refresh`.',
  '',
  'Другой конфиг - `JIRA_CONFIG_FILE`. Мод конфиг и токен не читает: всё ходит через `jira`.',
].join('\n')
