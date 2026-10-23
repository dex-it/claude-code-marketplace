/* @jsx h */
// Что рисует мод: строка над вводом, когда другим сессиям что-то от вас нужно,
// и панель `/sessions` - список и одна сессия подробно. Панель написана для
// того, кто видит её впервые: слова вместо статусов CLI, подсказка к каждому
// состоянию, три шага на пустом месте, опасные кнопки спрашивают второй раз.

import type {
  BoxProps,
  ButtonProps,
  ElementConstructor,
  InputProps,
  RenderElement,
  SelectProps,
  TextProps,
} from 'claude-code'

import type { DirChoice, Preset } from './dispatch.ts'
import { PHASE_HINT, PHASE_WORD, isFinished, tallyLine, tallyOf } from './sessions.ts'
import type { Phase, SessionRow } from './sessions.ts'
import { EMPTY_LIST, START_STEPS, ageWord, planLine, selectedIndex, shortPath, usageLine } from './text.ts'
import type { Entry } from './text.ts'
import { percentOf, topOf, windowOf } from './transcript.ts'

export type Ui = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
  /** Нет на телефоне: управляющий протокол пока не несёт ввода. */
  Input?: ElementConstructor<InputProps>
  Select?: ElementConstructor<SelectProps>
}

export type Actions = {
  select: (sessionId: string) => void
  openList: () => void
  step: (delta: 1 | -1) => void
  start: (task: string) => void
  chooseDir: (dir: string) => void
  say: (sessionId: string, text: string) => void
  stop: (sessionId: string) => void
  remove: (sessionId: string) => void
  open: (sessionId: string) => void
  logs: (sessionId: string) => void
  refreshNow: () => void
  toggleFinished: () => void
  toggleHere: () => void
}

export type Confirm = { kind: 'stop' | 'remove'; sessionId: string }

export type PaneModel = {
  columns: number
  view: 'list' | 'details'
  /** Показанные сессии в порядке списка; нумерация в панели и в командах одна. */
  entries: readonly Entry[]
  selectedId: string | null
  showFinished: boolean
  onlyHere: boolean
  /** Поле ввода есть не на всех поверхностях: там, где его нет, - команды. */
  canType: boolean
  windowSetting: number
  now: number
  home: string
  confirm: Confirm | null
  /** Сколько сессий спрятано фильтрами: чтобы «пусто» не обманывало. */
  hidden: number
  /** Готовые задачи кнопками; пусто, когда нужных команд в сессии нет. */
  presets: readonly Preset[]
  /** Папки на выбор для новой сессии и выбранная (пусто - текущая). */
  dirs: readonly DirChoice[]
  newDir: string
  /** Последнее, что сделал мод: запуск, отправка, отказ. Видно прямо в панели. */
  note: string
}

const PHASE_COLOR: Record<Phase, string> = {
  waiting: 'yellow',
  failed: 'red',
  working: 'cyan',
  idle: 'green',
  done: 'gray',
  stopped: 'gray',
  unknown: 'gray',
}

const BAR_CELLS = 10

export function barOf(percent: number): string {
  const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * BAR_CELLS)

  return `${'█'.repeat(filled)}${'░'.repeat(BAR_CELLS - filled)}`
}

const percentColor = (percent: number): string =>
  percent >= 85 ? 'red' : percent >= 60 ? 'yellow' : 'green'

/** Строка над вводом: появляется, только когда есть на что обратить внимание. */
export function bandView(
  ui: Ui,
  actions: Actions,
  rows: readonly SessionRow[],
  selfId: string,
  below: RenderElement,
): RenderElement {
  const { Box, Text, Button } = ui
  const others = rows.filter(row => row.sessionId !== selfId && !isFinished(row.phase))
  const tally = tallyOf(others)

  if (tally.waiting + tally.failed === 0) return below

  return (
    <Box flexDirection="column">
      {below}
      <Box flexDirection="row" gap={1}>
        <Text color="yellow" wrap="truncate-end">
          {tally.waiting > 0 ? `Сессий ждут вас: ${tally.waiting}` : ''}
          {tally.waiting > 0 && tally.failed > 0 ? ', ' : ''}
          {tally.failed > 0 ? `упали: ${tally.failed}` : ''}
        </Text>
        <Button key="band-sessions" label="открыть список" dimColor onPress={() => actions.openList()} />
      </Box>
    </Box>
  )
}

function contextCell(ui: Ui, entry: Entry, model: PaneModel): RenderElement {
  const { Text } = ui
  const stats = entry.stats

  if (!stats || stats.calls === 0) return <Text dimColor>контекст: -</Text>

  const percent = percentOf(stats.contextTokens, windowOf(stats, model.windowSetting))

  return (
    <Text color={percentColor(percent)}>
      {barOf(percent)} {percent}%
    </Text>
  )
}

function entryRow(ui: Ui, actions: Actions, model: PaneModel, entry: Entry): RenderElement {
  const { Box, Text, Button } = ui
  const { row } = entry
  const waiting = row.phase === 'waiting' && row.waitingFor !== '' ? ` - ${row.waitingFor}` : ''

  return (
    <Box key={`row:${row.sessionId}`} flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text dimColor>{entry.index}.</Text>
        <Button
          key={`open-details:${row.sessionId}`}
          label={`${row.name}${entry.isSelf ? ' (вы здесь)' : ''}`}
          onPress={() => actions.select(row.sessionId)}
        />
        <Text dimColor>{row.shortId}</Text>
        <Text color={PHASE_COLOR[row.phase]} wrap="truncate-end">
          {PHASE_WORD[row.phase]}
          {waiting}
        </Text>
      </Box>
      <Box flexDirection="row" gap={1} paddingLeft={3}>
        {contextCell(ui, entry, model)}
        <Text dimColor wrap="truncate-end">
          {row.kind === 'background' ? 'фон' : 'окно'} · {shortPath(row.cwd, model.home)}
        </Text>
      </Box>
    </Box>
  )
}

function newSessionBox(ui: Ui, actions: Actions, model: PaneModel): RenderElement {
  const { Box, Text, Input, Select } = ui

  const { Button } = ui
  const presetRow =
    model.presets.length > 0 ? (
      <Box flexDirection="row" gap={1}>
        <Text dimColor>Готовые задачи:</Text>
        {model.presets.map(preset => (
          <Button
            key={`preset:${preset.task}`}
            label={preset.label}
            dimColor
            onPress={() => actions.start(preset.task)}
          />
        ))}
      </Box>
    ) : (
      <Box />
    )

  if (!model.canType || !Input) {
    return <Text dimColor>Новая сессия: команда /sessions new &lt;задача&gt;</Text>
  }

  return (
    <Box flexDirection="column">
      <Text bold>Новая сессия</Text>
      {presetRow}
      {Select && model.dirs.length > 1 ? (
        <Select
          key="new-dir"
          label="Папка: "
          options={model.dirs.map(choice => ({ value: choice.value, label: choice.label }))}
          value={model.newDir !== '' ? model.newDir : model.dirs[0]?.value}
          onSelect={value => actions.chooseDir(value)}
        />
      ) : (
        <Box />
      )}
      <Input
        key="new-session"
        label="Задача: "
        placeholder="что сделать, одной-двумя фразами, затем Enter"
        submitLabel="запустить"
        onSubmit={value => actions.start(value)}
      />
    </Box>
  )
}

function controls(ui: Ui, actions: Actions, model: PaneModel): RenderElement {
  const { Box, Button, Text } = ui

  return (
    <Box flexDirection="row" gap={1}>
      <Button key="refresh" label="обновить" dimColor onPress={() => actions.refreshNow()} />
      <Button
        key="toggle-finished"
        label={model.showFinished ? 'спрятать законченные' : 'показать законченные'}
        dimColor
        onPress={() => actions.toggleFinished()}
      />
      <Button
        key="toggle-here"
        label={model.onlyHere ? 'показать все проекты' : 'только этот проект'}
        dimColor
        onPress={() => actions.toggleHere()}
      />
      {model.hidden > 0 ? <Text dimColor>скрыто фильтрами: {model.hidden}</Text> : <Box />}
    </Box>
  )
}

function noteLine(ui: Ui, model: PaneModel): RenderElement {
  const { Text, Box } = ui

  return model.note === '' ? <Box /> : <Text color="cyan" wrap="wrap">{model.note}</Text>
}

function listView(ui: Ui, actions: Actions, model: PaneModel): RenderElement {
  const { Box, Text } = ui
  const tally = tallyLine(tallyOf(model.entries.map(entry => entry.row)))

  return (
    <Box flexDirection="column">
      <Text bold>Сессии Claude Code на этой машине</Text>
      <Text dimColor>
        {model.entries.length === 0 ? EMPTY_LIST : tally}
      </Text>
      {model.entries.length === 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Как начать</Text>
          {START_STEPS.map(step => (
            <Text key={step} wrap="wrap">{step}</Text>
          ))}
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {model.entries.map(entry => entryRow(ui, actions, model, entry))}
          <Text dimColor>Нажмите на имя, чтобы увидеть сессию подробно.</Text>
        </Box>
      )}
      <Box marginTop={1} flexDirection="column">
        {newSessionBox(ui, actions, model)}
        {noteLine(ui, model)}
        {controls(ui, actions, model)}
      </Box>
    </Box>
  )
}

function fact(ui: Ui, name: string, value: string, color?: string): RenderElement {
  const { Box, Text } = ui

  return (
    <Box key={`fact:${name}`} flexDirection="row" gap={1}>
      <Box width={12} flexShrink={0}>
        <Text dimColor>{name}</Text>
      </Box>
      <Text wrap="wrap" {...(color === undefined ? {} : { color })}>{value}</Text>
    </Box>
  )
}

function nav(ui: Ui, actions: Actions, model: PaneModel, index: number): RenderElement {
  const { Box, Button, Text } = ui

  return (
    <Box flexDirection="row" gap={1}>
      <Button key="nav-list" label="‹ список" dimColor onPress={() => actions.openList()} />
      {model.entries.length > 1 ? (
        <Box flexDirection="row" gap={1}>
          <Button key="nav-prev" label="‹" dimColor onPress={() => actions.step(-1)} />
          <Text dimColor>
            {index + 1}/{model.entries.length}
          </Text>
          <Button key="nav-next" label="›" dimColor onPress={() => actions.step(1)} />
        </Box>
      ) : (
        <Box />
      )}
    </Box>
  )
}

function dangerButton(
  ui: Ui,
  actions: Actions,
  model: PaneModel,
  entry: Entry,
  kind: 'stop' | 'remove',
): RenderElement {
  const { Button } = ui
  const asked = model.confirm?.kind === kind && model.confirm.sessionId === entry.row.sessionId
  const label =
    kind === 'stop'
      ? asked ? 'точно остановить? нажмите ещё раз' : 'остановить'
      : asked ? 'точно удалить без возврата? нажмите ещё раз' : 'удалить'
  const press = () => (kind === 'stop' ? actions.stop(entry.row.sessionId) : actions.remove(entry.row.sessionId))

  return <Button key={`${kind}:${entry.row.sessionId}`} label={label} dimColor={!asked} onPress={press} />
}

function detailsView(ui: Ui, actions: Actions, model: PaneModel): RenderElement {
  const { Box, Text, Button, Input } = ui
  const index = selectedIndex(model.entries, model.selectedId)
  const entry = model.entries[index]

  if (!entry) {
    return (
      <Box flexDirection="column">
        <Text dimColor>Эта сессия больше не показана: она удалена или спрятана фильтром.</Text>
        <Button key="nav-list" label="‹ список" dimColor onPress={() => actions.openList()} />
      </Box>
    )
  }

  const { row, stats } = entry
  const todos = stats?.todos ?? []
  const skills = stats ? topOf(stats.skills, 5) : []
  const plan = planLine(stats)

  return (
    <Box flexDirection="column">
      {nav(ui, actions, model, index)}
      <Text bold wrap="truncate-end">
        {row.name}
        {entry.isSelf ? ' (текущая сессия)' : ''}
      </Text>
      <Text color={PHASE_COLOR[row.phase]} wrap="wrap">
        {PHASE_WORD[row.phase]}
        {row.waitingFor !== '' ? ` - ${row.waitingFor}` : ''}. {PHASE_HINT[row.phase]}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {fact(ui, 'Id', row.shortId)}
        {stats?.title ? fact(ui, 'Тема', stats.title) : <Box />}
        {fact(ui, 'Каталог', shortPath(row.cwd, model.home))}
        {fact(ui, 'Запущена', ageWord(row.startedAt, model.now) || 'неизвестно')}
        {stats?.model ? fact(ui, 'Модель', stats.model) : <Box />}
        {fact(ui, 'Расход', usageLine(stats, model.windowSetting))}
        {plan !== '' ? fact(ui, 'План', plan.replace(/^план: /, '')) : <Box />}
        {stats?.lastPrompt ? fact(ui, 'Задание', stats.lastPrompt) : <Box />}
        {stats?.lastAnswer ? fact(ui, 'Ответ', stats.lastAnswer) : <Box />}
        {fact(
          ui,
          'Навыки',
          skills.length > 0 ? skills.map(([name, count]) => `${name} x${count}`).join(', ') : 'не вызывались',
        )}
        {fact(
          ui,
          'Субагенты',
          stats && stats.subagents > 0
            ? `запущено ${stats.subagents}; последние: ${stats.subagentNotes.slice(-3).join('; ')}`
            : 'не запускались',
        )}
      </Box>
      {todos.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Шаги плана</Text>
          {todos.slice(0, 10).map((todo, position) => (
            <Text
              key={`todo:${position}`}
              wrap="truncate-end"
              color={todo.status === 'completed' ? 'green' : todo.status === 'in_progress' ? 'cyan' : 'gray'}
            >
              {todo.status === 'completed' ? '[x]' : todo.status === 'in_progress' ? '[>]' : '[ ]'} {todo.text}
            </Text>
          ))}
        </Box>
      ) : (
        <Box />
      )}
      {stats && stats.sent.length + stats.received.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Переписка с другими сессиями</Text>
          {stats.sent.slice(-3).map((note, position) => (
            <Text key={`sent:${position}`} dimColor wrap="truncate-end">
              → {note.who}: {note.text}
            </Text>
          ))}
          {stats.received.slice(-3).map((note, position) => (
            <Text key={`got:${position}`} dimColor wrap="truncate-end">
              ← {note.who}: {note.text}
            </Text>
          ))}
        </Box>
      ) : (
        <Box />
      )}
      <Box marginTop={1} flexDirection="row" gap={1}>
        <Button key="act-open" label="как открыть" onPress={() => actions.open(row.sessionId)} />
        <Button key="act-logs" label="что вывела" dimColor onPress={() => actions.logs(row.sessionId)} />
        {entry.isSelf ? <Box /> : dangerButton(ui, actions, model, entry, 'stop')}
        {entry.isSelf ? <Box /> : dangerButton(ui, actions, model, entry, 'remove')}
      </Box>
      {entry.isSelf ? (
        <Box />
      ) : model.canType && Input ? (
        <Box marginTop={1}>
          <Input
            key={`say:${row.sessionId}`}
            label="Сообщение сессии: "
            placeholder="задание или вопрос, затем Enter"
            submitLabel="отправить"
            onSubmit={value => actions.say(row.sessionId, value)}
          />
        </Box>
      ) : (
        <Text dimColor>Сообщение: /sessions say {row.shortId} &lt;текст&gt;</Text>
      )}
      {noteLine(ui, model)}
    </Box>
  )
}

export function paneView(ui: Ui, actions: Actions, model: PaneModel): RenderElement {
  return model.view === 'list' ? listView(ui, actions, model) : detailsView(ui, actions, model)
}
