/* @jsx h */
// What the mod draws. Two sites: one row per watched MR above the prompt,
// and the pane `/mr` opens beside the transcript. Only the four elements
// every surface has are used (Box, Text, Button, Link), so the terminal, the
// desktop app and the phone draw the same tree.

import type {
  BoxProps,
  ButtonProps,
  ElementConstructor,
  LinkProps,
  RenderElement,
  TextProps,
} from 'claude-code'

import type { MergeLevel, MrData, Thread } from './gitlab'
import { approvalsGiven, mergeLevel, shortenPath, threadTally } from './gitlab'
import type { Watched } from './watched'
import { openThreadsOf, plainThreadsOf, resolvedThreadsOf } from './watched'

export type Ui = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
  Link: ElementConstructor<LinkProps>
}

/**
 * Опроса здесь нет намеренно: он идёт сам - по таймеру, на конце хода и
 * после команды, меняющей MR, - а принудительный остаётся командой
 * `/mr refresh`, которая ещё и печатает состояние текстом для модели.
 */
export type Actions = {
  select: (key: string) => void
  openUrl: (url: string) => void
  /** Arms the MR's open threads to ride the next prompt as context. */
  ask: (key: string) => void
  stop: (key: string) => void
  toggleResolved: () => void
}

export type PaneModel = {
  /** Ширина тела панели: её отдаёт поверхность, выбрать её мод не может. */
  columns: number
  list: readonly Watched[]
  selectedKey: string | null
  showResolved: boolean
  armedKey: string | null
  /** Commits drawn in the pane; the rest are counted, not listed. */
  commitLimit: number
}

const STATE_COLOR: Record<string, string> = {
  opened: 'green',
  merged: 'magenta',
  closed: 'gray',
  locked: 'yellow',
}

const PIPELINE_COLOR: Record<string, string> = {
  success: 'green',
  failed: 'red',
  canceled: 'red',
  skipped: 'gray',
  manual: 'gray',
  scheduled: 'gray',
}

const MERGE_COLOR: Record<MergeLevel, string> = {
  good: 'green',
  bad: 'red',
  wait: 'yellow',
  idle: 'gray',
}

const mergeColor = (status: string) => MERGE_COLOR[mergeLevel(status)]

const pipelineColor = (status: string) => PIPELINE_COLOR[status] ?? 'yellow'

const stateWord = (data: MrData) =>
  data.state === 'opened' && data.draft ? 'draft' : data.state

/** Значок треда и отступ до метаданных: адресу эти колонки не достаются. */
const ICON_AND_GAP_COLUMNS = 4

/** Ширина колонки имени факта, пока панель достаточно широка. */
const FACT_LABEL_COLUMNS = 13

/** Уже этого колонка имён съедает слишком много, и факты идут через двоеточие. */
const ALIGNED_FACTS_MIN_COLUMNS = 56

/** Уже этого адрес не ужимается - дальше режется само имя файла. */
const MIN_ADDRESS_COLUMNS = 12

const clock = (ms: number) => (ms === 0 ? '-' : new Date(ms).toTimeString().slice(0, 8))

// --- The row above the prompt -------------------------------------------

function row(ui: Ui, actions: Actions, watched: Watched): RenderElement {
  const { Box, Text, Button, Link } = ui
  const data = watched.data

  if (!data) {
    return (
      <Box key={`row:${watched.key}`} flexDirection="row">
        <Text dimColor wrap="truncate-end">
          {`${watched.label} ${watched.error === undefined ? 'загружается...' : `GitLab: ${watched.error}`}`}
        </Text>
      </Box>
    )
  }

  const tally = threadTally(data.threads)
  const approvals = data.approvals

  return (
    <Box key={`row:${watched.key}`} flexDirection="row">
      <Box flexShrink={0}>
        <Link href={data.webUrl} label={watched.label} />
      </Box>
      <Text wrap="truncate-end">
        <Text color={STATE_COLOR[data.state] ?? 'gray'}>{` ${stateWord(data)}`}</Text>
        <Text dimColor>{' · '}</Text>
        <Text color={mergeColor(data.mergeStatus)}>{data.mergeStatus}</Text>
        {data.pipeline === null ? (
          <Text />
        ) : (
          <Text>
            <Text dimColor>{' · ci '}</Text>
            <Text color={pipelineColor(data.pipeline.status)}>{data.pipeline.status}</Text>
          </Text>
        )}
        <Text dimColor>{' · '}</Text>
        <Text color={tally.open > 0 ? 'yellow' : 'green'}>
          {`●${tally.open}/${tally.resolvable}`}
        </Text>
        <Text dimColor>{` · ✎${data.notesCount}`}</Text>
        <Text dimColor>
          {` · ↑${data.commits.length}${data.commitsCapped ? '+' : ''}`}
        </Text>
        {approvals === null || (approvals.required === null && approvals.by.length === 0) ? (
          <Text />
        ) : (
          <Text color={approvals.left === 0 || approvals.required === null ? 'green' : 'yellow'}>
            {` · ✔${approvalsGiven(approvals)}${approvals.required === null ? '' : `/${approvals.required}`}`}
          </Text>
        )}
        <Text color="red">{watched.error === undefined ? '' : ' · опрос не удался'}</Text>
        <Text dimColor>{` · ${data.title}`}</Text>
      </Text>
      {/* Приглушённые, но нарисованные: hover требует, чтобы терминал сообщал
          о мыши, а он это делает не везде. Нарисованную кнопку берёт и фокус
          полосы (ctrl+x tab), скрытую за hover - нет, её нет в дереве вовсе. */}
      <Box flexShrink={0} flexDirection="row">
        <Button
          key={`open:${watched.key}`}
          label="открыть"
          dimColor
          onPress={() => actions.openUrl(data.webUrl)}
        />
        <Button
          key={`pane:${watched.key}`}
          label="детали"
          dimColor
          onPress={() => actions.select(watched.key)}
        />
        <Button
          key={`stop:${watched.key}`}
          label="×"
          dimColor
          onPress={() => actions.stop(watched.key)}
        />
      </Box>
    </Box>
  )
}

/** Every watched MR, one row each, in the order they were added. */
export function bandView(
  ui: Ui,
  actions: Actions,
  list: readonly Watched[],
  beneath: RenderElement,
): RenderElement {
  const { Box } = ui

  return (
    <Box flexDirection="column">
      {list.map(watched => row(ui, actions, watched))}
      {beneath}
    </Box>
  )
}

// --- The pane -----------------------------------------------------------

function tabs(ui: Ui, actions: Actions, model: PaneModel): RenderElement {
  const { Box, Text, Button } = ui

  if (model.list.length < 2) return <Box />

  return (
    <Box flexDirection="row" flexWrap="wrap">
      <Text dimColor>{'MR: '}</Text>
      {model.list.map(watched => (
        <Button
          key={`tab:${watched.key}`}
          label={watched.key === model.selectedKey ? `[${watched.label}]` : watched.label}
          dimColor={watched.key !== model.selectedKey}
          onPress={() => actions.select(watched.key)}
        />
      ))}
    </Box>
  )
}

function threadRow(ui: Ui, thread: Thread, columns: number): RenderElement {
  const { Box, Text, Link } = ui

  const address =
    thread.file === null
      ? 'обсуждение MR'
      : `${thread.file}${thread.line === null ? '' : `:${thread.line}`}`

  // Метаданные считаются первыми, и уже под них ужимается адрес: иначе строка
  // выходит за край панели и режется именно на них - на том, кто и сколько.
  const short = `${thread.author} \u00b7 \u270e${thread.notes}`
  const full = `${short} \u00b7 последний ${thread.lastAuthor}`
  const isSame = thread.lastAuthor === thread.author
  const roomFor = (meta: string) => columns - meta.length - ICON_AND_GAP_COLUMNS
  const meta = !isSame && roomFor(full) >= MIN_ADDRESS_COLUMNS ? full : short
  const where = shortenPath(address, Math.max(MIN_ADDRESS_COLUMNS, roomFor(meta)))

  return (
    <Box key={`thread:${thread.id}`} flexDirection="column">
      <Box flexDirection="row">
        <Box flexShrink={0}>
          <Text color={thread.resolved ? 'green' : 'yellow'}>
            {thread.resolved ? '\u2713 ' : '\u25cf '}
          </Text>
        </Box>
        <Box flexShrink={0}>
          <Link href={thread.url} label={where} />
        </Box>
        <Text dimColor wrap="truncate-end">{`  ${meta}`}</Text>
      </Box>
      <Box flexDirection="row">
        <Box flexShrink={0}>
          <Text>{'  '}</Text>
        </Box>
        <Text wrap="truncate-end">{thread.body}</Text>
      </Box>
      <Text>{' '}</Text>
    </Box>
  )
}

/** Пустая строка: ею разделяются блоки панели. */
const gap = (ui: Ui, key: string): RenderElement => <ui.Text key={key}>{' '}</ui.Text>

/**
 * Строка факта: имя и значение. Имя выравнивается в колонку, пока панель
 * шире `ALIGNED_FACTS_MIN_COLUMNS`; уже - имя и значение идут через двоеточие,
 * потому что колонка в тринадцать знаков там съедает четверть ширины.
 */
function factRow(
  ui: Ui,
  columns: number,
  name: string,
  value: string,
  color?: string,
): RenderElement {
  const { Text } = ui
  const isAligned = columns >= ALIGNED_FACTS_MIN_COLUMNS
  const label = isAligned ? name.padEnd(FACT_LABEL_COLUMNS) : `${name}: `

  return (
    <Text key={`fact:${name}`} wrap="truncate-end">
      <Text dimColor>{label}</Text>
      <Text color={color}>{value}</Text>
    </Text>
  )
}

/**
 * Вся карточка MR: шапка, факты по строке на факт, действия, открытые треды,
 * обсуждение, закрытые под сворачиванием и коммиты. Блоки разделены пустой
 * строкой - в докнутой панели без них всё сливается в стену.
 */
export function paneView(ui: Ui, actions: Actions, model: PaneModel): RenderElement {
  const { Box, Text, Button, Link } = ui
  const watched = model.list.find(entry => entry.key === model.selectedKey) ?? model.list[0]

  if (!watched) {
    return <Text dimColor>Ни один merge request не отслеживается.</Text>
  }

  const data = watched.data

  if (!data) {
    return (
      <Box flexDirection="column">
        {tabs(ui, actions, model)}
        <Text dimColor>
          {watched.error === undefined ? 'загружается...' : `GitLab: ${watched.error}`}
        </Text>
      </Box>
    )
  }

  const open = openThreadsOf(data)
  const resolved = resolvedThreadsOf(data)
  const plain = plainThreadsOf(data)
  const approvals = data.approvals
  const commits = data.commits.slice(0, model.commitLimit)
  const columns = model.columns
  const fact = (name: string, value: string, color?: string) =>
    factRow(ui, columns, name, value, color)

  // Апрувы прячутся, когда правил нет и никто не апрувил: на редакции без
  // правил эндпоинт отдаёт пустой `approved_by`, и «0» там - не факт, а шум.
  const hasApprovals = approvals !== null && !(approvals.required === null && approvals.by.length === 0)

  return (
    <Box flexDirection="column">
      {tabs(ui, actions, model)}
      <Text bold wrap="truncate-end">{data.title}</Text>
      <Box flexDirection="row">
        <Box flexShrink={0}>
          <Link href={data.webUrl} label={watched.label} />
        </Box>
        <Text color={STATE_COLOR[data.state] ?? 'gray'} wrap="truncate-end">
          {`  ${stateWord(data)}`}
        </Text>
      </Box>
      {gap(ui, 'gap:head')}

      {fact('Ветки', `${data.sourceBranch} -> ${data.targetBranch}`)}
      {fact('Автор', data.author)}
      {fact(
        'Merge',
        data.hasConflicts ? `${data.mergeStatus}, есть конфликты` : data.mergeStatus,
        mergeColor(data.mergeStatus),
      )}
      {data.pipeline === null
        ? fact('Пайплайн', 'нет')
        : fact('Пайплайн', data.pipeline.status, pipelineColor(data.pipeline.status))}
      {hasApprovals && approvals !== null
        ? fact(
            'Апрувы',
            `${approvalsGiven(approvals)}${approvals.required === null ? '' : `/${approvals.required}`}` +
              (approvals.by.length === 0 ? '' : ` (${approvals.by.join(', ')})`),
            approvals.left === 0 || approvalsGiven(approvals) > 0 ? 'green' : 'yellow',
          )
        : <Box key="fact:approvals" />}
      {fact(
        'Треды',
        `${open.length} открытых из ${threadTally(data.threads).resolvable}`,
        open.length > 0 ? 'yellow' : 'green',
      )}
      {fact('Комментарии', String(data.notesCount))}
      {fact('Коммиты', `${data.commits.length}${data.commitsCapped ? '+' : ''}`)}
      {data.changesCount === '' ? <Box key="fact:files" /> : fact('Файлов', data.changesCount)}
      {data.reviewers.length > 0 ? fact('Ревью', data.reviewers.join(', ')) : <Box key="fact:rev" />}
      {data.labels.length > 0 ? fact('Метки', data.labels.join(', ')) : <Box key="fact:lab" />}
      {gap(ui, 'gap:facts')}

      <Box flexDirection="row" flexWrap="wrap">
        <Button
          key={`pane-open:${watched.key}`}
          label="открыть в браузере"
          onPress={() => actions.openUrl(data.webUrl)}
        />
        <Text>{' '}</Text>
        <Button
          key={`pane-ask:${watched.key}`}
          label={model.armedKey === watched.key ? 'треды \u2713 в промпте' : 'треды в промпт'}
          onPress={() => actions.ask(watched.key)}
        />
        <Text>{' '}</Text>
        <Button
          key={`pane-stop:${watched.key}`}
          label="снять с отслеживания"
          dimColor
          onPress={() => actions.stop(watched.key)}
        />
      </Box>
      {gap(ui, 'gap:actions')}

      <Text bold>
        {open.length === 0 ? 'Открытых тредов нет' : `Открытые треды (${open.length})`}
      </Text>
      {gap(ui, 'gap:open')}
      {open.map(thread => threadRow(ui, thread, columns))}

      {plain.length === 0 ? (
        <Box />
      ) : (
        <Box flexDirection="column">
          <Text bold>{`Обсуждение MR (${plain.length})`}</Text>
          {gap(ui, 'gap:plain')}
          {plain.map(thread => threadRow(ui, thread, columns))}
        </Box>
      )}

      {resolved.length === 0 ? (
        <Box />
      ) : (
        <Box flexDirection="column">
          <Button
            key="toggle-resolved"
            label={`${model.showResolved ? '\u25be' : '\u25b8'} Закрытые треды (${resolved.length})`}
            dimColor
            onPress={() => actions.toggleResolved()}
          />
          {model.showResolved ? (
            <Box flexDirection="column">
              {gap(ui, 'gap:resolved')}
              {resolved.map(thread => threadRow(ui, thread, columns))}
            </Box>
          ) : (
            <Box />
          )}
          {gap(ui, 'gap:resolved-end')}
        </Box>
      )}

      {commits.length === 0 ? (
        <Box />
      ) : (
        <Box flexDirection="column">
          <Text bold>{`Коммиты (${data.commits.length}${data.commitsCapped ? '+' : ''})`}</Text>
          {gap(ui, 'gap:commits')}
          {commits.map(commit => (
            <Text key={`commit:${commit.sha}`} dimColor wrap="truncate-end">
              {`${commit.sha}  ${commit.title}`}
            </Text>
          ))}
        </Box>
      )}
      {gap(ui, 'gap:tail')}

      <Text dimColor wrap="truncate-end">
        {`обновлено ${clock(watched.updatedMs)}${watched.error === undefined ? '' : ` \u00b7 опрос не удался: ${watched.error}`}`}
      </Text>
    </Box>
  )
}
