/* @jsx h */
// What the mod draws. Two sites: a band of one to three rows above the prompt,
// and the pane `/jira` opens beside the transcript - a list of issues, and the
// details of one. Only the elements every surface has are used (Box, Text,
// Button, Link, Input), so the terminal, the desktop app and the phone draw the
// same tree.

import type {
  BoxProps,
  ButtonProps,
  ElementConstructor,
  InputProps,
  LinkProps,
  RenderElement,
  TextProps,
} from 'claude-code'

import { firstLine } from './jira.ts'
import type { Filter, Overview, Row } from './overview.ts'
import { ATTENTION_MANY, FILTERS, FILTER_WORD } from './overview.ts'
import type { Tracked } from './watched.ts'

export type Ui = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
  Link: ElementConstructor<LinkProps>
  /** Terminal and desktop have it; the phone's control protocol carries presses only. */
  Input?: ElementConstructor<InputProps>
}

/**
 * Polling is not here on purpose: it runs by itself - on a timer, at the end
 * of a turn - and the forced one stays the command `/jira refresh`, which also
 * prints the list as text for the model.
 */
export type Actions = {
  select: (key: string) => void
  openList: () => void
  step: (delta: 1 | -1) => void
  setFilter: (filter: Filter) => void
  refreshNow: () => void
  openUrl: (url: string) => void
  /** Write a statement of the task: for an issue, or from an idea typed in the field. */
  spec: (key: string | null, idea: string) => void
  publish: (key: string | null) => void
  work: (key: string) => void
  ship: (key: string) => void
  seen: (key: string | 'all') => void
  comments: (key: string) => void
  hosting: () => void
  setup: () => void
}

export type PaneView = 'list' | 'details'

export type BandModel = {
  overview: Overview
  project: string
  /** Why there is no data: set where the source is missing or refused. Empty - all is well. */
  problem: string
  /** Rows of issues that wait for the person, drawn under the tally. */
  waiting: readonly Row[]
}

export type PaneModel = {
  columns: number
  view: PaneView
  filter: Filter
  overview: Overview
  list: readonly Tracked[]
  selectedKey: string | null
  scopeWord: string
  project: string
  problem: string
  truncated: boolean
  /** Keys with a write in flight: the button says so and does not fire twice. */
  busy: ReadonlySet<string>
  /** Address of an issue in the browser; '' where not known yet. */
  urlOf: (key: string) => string
  /** Is there a PR/MR tracker of the catalog to hand over to. */
  hasHosting: boolean
  descriptionLines: number
  commentLimit: number
  updatedMs: number
}

const ATTENTION_COLOR = { act: 'red', fresh: 'yellow', live: 'gray', idle: 'gray' } as const

const ATTENTION_MARK = { act: '●', fresh: '●', live: '·', idle: '✓' } as const

const GROUP_COLOR = { progress: 'cyan', open: 'white', done: 'gray' } as const

const GROUP_WORD = { progress: 'в работе', open: 'открыта', done: 'закрыта' } as const

const LEVEL_COLOR = { good: 'green', bad: 'red', wait: 'yellow', info: 'gray' } as const

const clock = (ms: number) => (ms === 0 ? '-' : new Date(ms).toTimeString().slice(0, 8))

const FACT_LABEL_COLUMNS = 13

const ALIGNED_FACTS_MIN_COLUMNS = 56

/** A blank line: the blocks of the pane are separated by it. */
const gap = (ui: Ui, key: string): RenderElement => <ui.Text key={key}>{' '}</ui.Text>

// --- The band above the prompt ----------------------------------------------

function tallyRow(ui: Ui, actions: Actions, band: BandModel): RenderElement {
  const { Box, Text, Button } = ui
  const view = band.overview

  return (
    <Box key="row:tally" flexDirection="row">
      <Box flexShrink={0}>
        <Text bold>{`Jira${band.project === '' ? '' : ` ${band.project}`}`}</Text>
      </Box>
      <Text wrap="truncate-end">
        <Text color="cyan">{` · в работе ${view.progress}`}</Text>
        <Text dimColor>{` · открытых ${view.open}`}</Text>
        <Text>{` · мои ${view.mine}`}</Text>
        {view.act === 0 ? (
          <Text />
        ) : (
          <Text color="red">{` · ${view.act} ${ATTENTION_MANY.act}`}</Text>
        )}
        {view.fresh - view.act <= 0 ? (
          <Text />
        ) : (
          <Text color="yellow">{` · новое: ${view.fresh - view.act}`}</Text>
        )}
      </Text>
      <Box flexShrink={0} flexDirection="row">
        <Button key="band-list" label="список" dimColor onPress={() => actions.openList()} />
        <Button key="band-refresh" label="обновить" dimColor onPress={() => actions.refreshNow()} />
      </Box>
    </Box>
  )
}

function waitingRow(ui: Ui, actions: Actions, row: Row): RenderElement {
  const { Box, Text, Button } = ui

  return (
    <Box key={`band:${row.key}`} flexDirection="row">
      <Box flexShrink={0}>
        <Text color="red">{'● '}</Text>
        <Text bold>{row.key}</Text>
      </Box>
      <Text wrap="truncate-end">
        <Text color="yellow">{`  ${row.reason}`}</Text>
        <Text dimColor>{`  ${firstLine(row.summary, 80)}`}</Text>
      </Text>
      <Box flexShrink={0}>
        <Button key={`band-open:${row.key}`} label="детали" dimColor onPress={() => actions.select(row.key)} />
      </Box>
    </Box>
  )
}

/**
 * The band: a tally and, under it, the few issues that wait for the person.
 * Three rows at most - more is the list's job - and nothing at all while the
 * source is down, except one line that says why and what to do.
 */
export function bandView(
  ui: Ui,
  actions: Actions,
  band: BandModel,
  beneath: RenderElement,
): RenderElement {
  const { Box, Text, Button } = ui

  if (band.problem !== '') {
    return (
      <Box flexDirection="column">
        <Box key="row:problem" flexDirection="row">
          <Text color="yellow" wrap="truncate-end">{`Jira: ${band.problem}`}</Text>
          <Box flexShrink={0}>
            <Button key="band-setup" label="как настроить" dimColor onPress={() => actions.setup()} />
          </Box>
        </Box>
        {beneath}
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {tallyRow(ui, actions, band)}
      {band.waiting.map(row => waitingRow(ui, actions, row))}
      {beneath}
    </Box>
  )
}

// --- The list -----------------------------------------------------------------

function listRow(ui: Ui, actions: Actions, row: Row, model: PaneModel): RenderElement {
  const { Box, Text, Button } = ui
  const isBusy = model.busy.has(row.key)
  const canTake = row.group !== 'done'

  return (
    <Box key={`list:${row.key}`} flexDirection="row">
      <Box flexShrink={0}>
        <Text color={ATTENTION_COLOR[row.attention]}>{`${ATTENTION_MARK[row.attention]} `}</Text>
      </Box>
      <Box flexShrink={0}>
        <Button key={`list-open:${row.key}`} label={row.key} onPress={() => actions.select(row.key)} />
      </Box>
      <Text wrap="truncate-end">
        <Text color={row.attention === 'live' || row.attention === 'idle' ? GROUP_COLOR[row.group] : ATTENTION_COLOR[row.attention]}>
          {`  ${row.reason}`}
        </Text>
        <Text dimColor>{`  ${row.mine ? 'вы' : row.assignee}`}</Text>
        <Text dimColor>{`  ${firstLine(row.summary, 90)}`}</Text>
      </Text>
      {canTake ? (
        <Box flexShrink={0}>
          <Button
            key={`list-work:${row.key}`}
            label={isBusy ? 'берём...' : row.group === 'progress' && row.mine ? 'сдать' : 'взять'}
            dimColor
            onPress={() => (row.group === 'progress' && row.mine ? actions.ship(row.key) : actions.work(row.key))}
          />
        </Box>
      ) : (
        <Box />
      )}
    </Box>
  )
}

function filterRow(ui: Ui, actions: Actions, model: PaneModel): RenderElement {
  const { Box, Text, Button } = ui
  const view = model.overview
  const counts: Record<Filter, number> = {
    all: view.total,
    progress: view.progress,
    open: view.open,
    mine: view.mine,
    fresh: view.fresh,
    done: view.done,
  }

  return (
    <Box flexDirection="row" flexWrap="wrap">
      {FILTERS.map(filter => (
        <Box key={`filter:${filter}`} flexDirection="row">
          <Button
            label={`${filter === model.filter ? '[' : ''}${FILTER_WORD[filter]} ${counts[filter]}${filter === model.filter ? ']' : ''}`}
            dimColor={filter !== model.filter}
            onPress={() => actions.setFilter(filter)}
          />
          <Text>{' '}</Text>
        </Box>
      ))}
      <Button key="list-refresh" label="обновить" dimColor onPress={() => actions.refreshNow()} />
    </Box>
  )
}

function ideaField(ui: Ui, actions: Actions): RenderElement {
  const { Box, Text, Input } = ui

  if (Input === undefined) {
    return <Text dimColor>Новая задача: /jira spec &lt;идея&gt; - составлю постановку.</Text>
  }

  return (
    <Box flexDirection="column">
      <Text dimColor>Новая задача: опишите идею своими словами - составлю постановку (в Jira она попадёт только по «оформляй»).</Text>
      <Input
        key="idea"
        placeholder="например: выгрузка отчёта по заказам в csv"
        submitLabel="постановка"
        onSubmit={value => {
          if (value.trim() !== '') actions.spec(null, value)
        }}
      />
    </Box>
  )
}

export function listView(ui: Ui, actions: Actions, model: PaneModel): RenderElement {
  const { Box, Text } = ui
  const view = model.overview

  return (
    <Box flexDirection="column">
      <Text bold wrap="truncate-end">
        {`Jira${model.project === '' ? '' : ` ${model.project}`} · ${model.scopeWord} · ${view.total}`}
      </Text>
      {filterRow(ui, actions, model)}
      {gap(ui, 'gap:list-head')}
      {view.rows.length === 0 ? (
        <Text dimColor>{view.total === 0 ? 'Задач в наблюдении нет.' : 'В этом отборе задач нет.'}</Text>
      ) : (
        view.rows.map(row => listRow(ui, actions, row, model))
      )}
      {model.truncated ? (
        <Text color="yellow" wrap="truncate-end">
          Список обрезан лимитом (настройка limit): видны самые свежие по обновлению.
        </Text>
      ) : (
        <Box />
      )}
      {gap(ui, 'gap:list-rows')}
      {ideaField(ui, actions)}
      {gap(ui, 'gap:list-idea')}
      <Text dimColor wrap="truncate-end">
        {`обновлено ${clock(model.updatedMs)} · нажмите ключ, чтобы открыть детали`}
      </Text>
    </Box>
  )
}

// --- Details --------------------------------------------------------------------

function fact(ui: Ui, columns: number, name: string, value: string, color?: string): RenderElement {
  const { Text } = ui
  const label = columns >= ALIGNED_FACTS_MIN_COLUMNS ? name.padEnd(FACT_LABEL_COLUMNS) : `${name}: `

  return (
    <Text key={`fact:${name}`} wrap="truncate-end">
      <Text dimColor>{label}</Text>
      <Text color={color}>{value}</Text>
    </Text>
  )
}

function navigation(ui: Ui, actions: Actions, model: PaneModel): RenderElement {
  const { Box, Text, Button } = ui
  const keys = model.overview.rows.map(row => row.key)
  const place = Math.max(0, keys.indexOf(model.selectedKey ?? ''))

  return (
    <Box flexDirection="row" flexWrap="wrap">
      <Button key="nav-list" label="‹ список" onPress={() => actions.openList()} />
      <Text>{'  '}</Text>
      <Button key="nav-prev" label="‹" onPress={() => actions.step(-1)} />
      <Text dimColor>{` ${place + 1}/${keys.length} `}</Text>
      <Button key="nav-next" label="›" onPress={() => actions.step(1)} />
    </Box>
  )
}

export function detailsView(ui: Ui, actions: Actions, model: PaneModel): RenderElement {
  const { Box, Text, Button, Link } = ui
  const entry = model.list.find(item => item.key === model.selectedKey) ?? model.list[0]

  if (!entry) return <Text dimColor>Задач в наблюдении нет.</Text>

  const issue = entry.issue
  const url = model.urlOf(entry.key)
  const columns = model.columns
  const row = (name: string, value: string, color?: string) => fact(ui, columns, name, value, color)
  const isBusy = model.busy.has(entry.key)
  const description = issue.description.trim().split('\n').filter(line => line.trim() !== '')
  const comments = (entry.detail?.comments ?? []).slice(-model.commentLimit).reverse()
  const isOpen = entry.group !== 'done'
  const isWorking = entry.group === 'progress' && entry.mine

  return (
    <Box flexDirection="column">
      {navigation(ui, actions, model)}
      <Text bold wrap="truncate-end">{issue.summary}</Text>
      <Box flexDirection="row">
        <Box flexShrink={0}>
          {url === '' ? <Text>{entry.key}</Text> : <Link href={url} label={entry.key} />}
        </Box>
        <Text color={GROUP_COLOR[entry.group]} wrap="truncate-end">{`  ${issue.status || GROUP_WORD[entry.group]}`}</Text>
      </Box>
      {gap(ui, 'gap:head')}

      {row('Тип', issue.type || '-')}
      {row('Приоритет', issue.priority || '-')}
      {row('Исполнитель', entry.mine ? `${issue.assignee ?? ''} (вы)` : (issue.assignee ?? 'не назначена'), entry.mine ? 'green' : undefined)}
      {row('Автор', issue.reporter ?? '-')}
      {row('Обновлена', issue.updated.slice(0, 16).replace('T', ' '))}
      {issue.labels.length > 0 ? row('Метки', issue.labels.join(', ')) : <Box key="fact:labels" />}
      {issue.components.length > 0 ? row('Компоненты', issue.components.join(', ')) : <Box key="fact:components" />}
      {entry.branch === undefined ? <Box key="fact:branch" /> : row('Ветка', entry.branch, 'cyan')}
      {gap(ui, 'gap:facts')}

      <Box flexDirection="row" flexWrap="wrap">
        {url === '' ? (
          <Box />
        ) : (
          <Box flexDirection="row">
            <Button key={`pane-open:${entry.key}`} label="открыть в браузере" onPress={() => actions.openUrl(url)} />
            <Text>{' '}</Text>
          </Box>
        )}
        <Button key={`pane-spec:${entry.key}`} label="постановка" onPress={() => actions.spec(entry.key, '')} />
        <Text>{' '}</Text>
        {isOpen ? (
          <Box flexDirection="row">
            <Button
              key={`pane-work:${entry.key}`}
              label={isBusy ? 'берём...' : isWorking ? 'продолжить' : 'взять в работу'}
              dimColor={isBusy}
              onPress={() => actions.work(entry.key)}
            />
            <Text>{' '}</Text>
            <Button key={`pane-ship:${entry.key}`} label="сдать (PR/MR)" onPress={() => actions.ship(entry.key)} />
            <Text>{' '}</Text>
          </Box>
        ) : (
          <Box />
        )}
        <Button key={`pane-publish:${entry.key}`} label="оформить в Jira" dimColor onPress={() => actions.publish(entry.key)} />
        <Text>{' '}</Text>
        <Button key={`pane-comments:${entry.key}`} label="комментарии в чат" dimColor onPress={() => actions.comments(entry.key)} />
        <Text>{' '}</Text>
        {model.hasHosting ? (
          <Box flexDirection="row">
            <Button key="pane-hosting" label="PR/MR" dimColor onPress={() => actions.hosting()} />
            <Text>{' '}</Text>
          </Box>
        ) : (
          <Box />
        )}
        {entry.fresh.length > 0 ? (
          <Button key={`pane-seen:${entry.key}`} label="просмотрено" dimColor onPress={() => actions.seen(entry.key)} />
        ) : (
          <Box />
        )}
      </Box>
      {gap(ui, 'gap:actions')}

      {entry.fresh.length === 0 ? (
        <Box />
      ) : (
        <Box flexDirection="column">
          <Text bold>{`Новое (${entry.fresh.length})`}</Text>
          {entry.fresh.map((change, index) => (
            <Text key={`fresh:${index}`} color={LEVEL_COLOR[change.level]} wrap="truncate-end">{`● ${change.text}`}</Text>
          ))}
          {gap(ui, 'gap:fresh')}
        </Box>
      )}

      <Text bold>Описание</Text>
      {description.length === 0 ? <Text dimColor>(описания нет)</Text> : <Box />}
      {description.slice(0, model.descriptionLines).map((line, index) => (
        <Text key={`desc:${index}`} wrap="truncate-end">{line}</Text>
      ))}
      {description.length > model.descriptionLines ? (
        <Text dimColor>{`... ещё ${description.length - model.descriptionLines} строк, целиком - в браузере или /jira ${entry.key} в чат`}</Text>
      ) : (
        <Box />
      )}
      {gap(ui, 'gap:description')}

      {comments.length === 0 ? (
        <Box />
      ) : (
        <Box flexDirection="column">
          <Text bold>{`Комментарии (${entry.detail?.total ?? comments.length})`}</Text>
          {comments.map(comment => (
            <Box key={`comment:${comment.id}`} flexDirection="column">
              <Text dimColor wrap="truncate-end">{`${comment.author}, ${comment.created.slice(0, 16).replace('T', ' ')}`}</Text>
              <Text wrap="truncate-end">{firstLine(comment.text, 200)}</Text>
            </Box>
          ))}
          {gap(ui, 'gap:comments')}
        </Box>
      )}

      <Text dimColor wrap="truncate-end">{`обновлено ${clock(model.updatedMs)}`}</Text>
    </Box>
  )
}

export function paneView(ui: Ui, actions: Actions, model: PaneModel): RenderElement {
  const { Box, Text, Button } = ui

  if (model.problem !== '') {
    return (
      <Box flexDirection="column">
        <Text color="yellow">{model.problem}</Text>
        <Box flexDirection="row">
          <Button key="pane-setup" label="как настроить" onPress={() => actions.setup()} />
          <Text>{' '}</Text>
          <Button key="pane-retry" label="проверить снова" dimColor onPress={() => actions.refreshNow()} />
        </Box>
      </Box>
    )
  }

  return model.view === 'list' ? listView(ui, actions, model) : detailsView(ui, actions, model)
}
