/* @jsx h */
// What the mod draws. Two sites: one row per watched pull request above the
// prompt, and the pane `/pr` opens beside the transcript. Only the four
// elements every surface has are used (Box, Text, Button, Link), so the
// terminal, the desktop app and the phone draw the same tree.

import type {
  BoxProps,
  ButtonProps,
  ElementConstructor,
  LinkProps,
  RenderElement,
  TextProps,
} from 'claude-code'

import type { Check, CheckLevel, MergeLevel, PrData, Thread } from './github.ts'
import { decisionWord, mergeLevel, shortenPath, threadTally } from './github.ts'
import type { Watched } from './watched.ts'
import { openThreadsOf, resolvedThreadsOf } from './watched.ts'

export type Ui = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
  Link: ElementConstructor<LinkProps>
}

/**
 * Опроса здесь нет намеренно: он идёт сам - по таймеру, на конце хода и
 * после команды, меняющей PR, - а принудительный остаётся командой
 * `/pr refresh`, которая ещё и печатает состояние текстом для модели.
 */
export type Actions = {
  select: (key: string) => void
  openUrl: (url: string) => void
  /** Arms the PR's open threads to ride the next prompt as context. */
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
  /** Checks drawn in the pane; a red matrix of thirty jobs is not readable. */
  checkLimit: number
}

const STATE_COLOR: Record<string, string> = {
  OPEN: 'green',
  MERGED: 'magenta',
  CLOSED: 'gray',
}

const CHECKS_COLOR: Record<CheckLevel, string> = {
  ok: 'green',
  bad: 'red',
  wait: 'yellow',
}

const MERGE_COLOR: Record<MergeLevel, string> = {
  good: 'green',
  bad: 'red',
  wait: 'yellow',
  idle: 'gray',
}

const DECISION_COLOR: Record<string, string> = {
  APPROVED: 'green',
  CHANGES_REQUESTED: 'red',
  REVIEW_REQUIRED: 'yellow',
}

const mergeColor = (status: string) => MERGE_COLOR[mergeLevel(status)]

const checksColor = (level: CheckLevel) => CHECKS_COLOR[level]

const stateWord = (data: PrData) =>
  data.state === 'OPEN' && data.draft ? 'draft' : data.state.toLowerCase()

/**
 * Показывать ли отметку ревью. Репозиторий без обязательного ревью отдаёт
 * `reviewDecision` null, и `✔0` на каждом PR был бы шумом, а не фактом.
 */
const hasReview = (data: PrData) =>
  data.reviews.decision !== null ||
  data.reviews.approved.length > 0 ||
  data.reviews.changesRequested.length > 0

const reviewColor = (data: PrData) =>
  data.reviews.decision === null
    ? 'gray'
    : (DECISION_COLOR[data.reviews.decision] ?? 'yellow')

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
          {`${watched.label} ${watched.error === undefined ? 'загружается...' : `GitHub: ${watched.error}`}`}
        </Text>
      </Box>
    )
  }

  const tally = threadTally(data.threads)

  return (
    <Box key={`row:${watched.key}`} flexDirection="row">
      <Box flexShrink={0}>
        <Link href={data.webUrl} label={watched.label} />
      </Box>
      <Text wrap="truncate-end">
        <Text color={STATE_COLOR[data.state] ?? 'gray'}>{` ${stateWord(data)}`}</Text>
        <Text dimColor>{' · '}</Text>
        <Text color={mergeColor(data.mergeStatus)}>{data.mergeStatus.toLowerCase()}</Text>
        {data.checks === null ? (
          <Text />
        ) : (
          <Text>
            <Text dimColor>{' · ci '}</Text>
            <Text color={checksColor(data.checks.level)}>{data.checks.word}</Text>
          </Text>
        )}
        <Text dimColor>{' · '}</Text>
        <Text color={tally.open > 0 ? 'yellow' : 'green'}>
          {`●${tally.open}/${tally.total}`}
        </Text>
        <Text dimColor>{` · ✎${data.comments}`}</Text>
        <Text dimColor>{` · ↑${data.commitsTotal}`}</Text>
        {hasReview(data) ? (
          <Text color={reviewColor(data)}>{` · ✔${data.reviews.approved.length}`}</Text>
        ) : (
          <Text />
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

/** Every watched pull request, one row each, in the order they were added. */
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
      <Text dimColor>{'PR: '}</Text>
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
      ? 'обсуждение кода'
      : `${thread.file}${thread.line === null ? '' : `:${thread.line}`}`

  // Метаданные считаются первыми, и уже под них ужимается адрес: иначе строка
  // выходит за край панели и режется именно на них - на том, кто и сколько.
  const short = `${thread.author} · ✎${thread.notes}`
  const full = `${short} · последний ${thread.lastAuthor}`
  const isSame = thread.lastAuthor === thread.author
  const roomFor = (meta: string) => columns - meta.length - ICON_AND_GAP_COLUMNS
  const meta = !isSame && roomFor(full) >= MIN_ADDRESS_COLUMNS ? full : short
  const where = shortenPath(address, Math.max(MIN_ADDRESS_COLUMNS, roomFor(meta)))

  return (
    <Box key={`thread:${thread.id}`} flexDirection="column">
      <Box flexDirection="row">
        <Box flexShrink={0}>
          <Text color={thread.resolved ? 'green' : thread.outdated ? 'gray' : 'yellow'}>
            {thread.resolved ? '✓ ' : '● '}
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

function checkRow(ui: Ui, check: Check): RenderElement {
  const { Box, Text, Link } = ui

  return (
    <Box key={`check:${check.name}`} flexDirection="row">
      <Box flexShrink={0}>
        <Text color={check.level === 'bad' ? 'red' : 'yellow'}>
          {check.level === 'bad' ? '✗ ' : '○ '}
        </Text>
      </Box>
      {check.url === '' ? (
        <Text wrap="truncate-end">{check.name}</Text>
      ) : (
        <Box flexShrink={0}>
          <Link href={check.url} label={check.name} />
        </Box>
      )}
      <Text dimColor wrap="truncate-end">
        {`  ${check.word}${check.required ? '' : ', необязательная'}`}
      </Text>
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
 * Вся карточка PR: шапка, факты по строке на факт, действия, открытые треды,
 * не зелёные проверки, закрытые треды под сворачиванием и коммиты. Блоки
 * разделены пустой строкой - в докнутой панели без них всё сливается в стену.
 */
export function paneView(ui: Ui, actions: Actions, model: PaneModel): RenderElement {
  const { Box, Text, Button, Link } = ui
  const watched = model.list.find(entry => entry.key === model.selectedKey) ?? model.list[0]

  if (!watched) {
    return <Text dimColor>Ни один pull request не отслеживается.</Text>
  }

  const data = watched.data

  if (!data) {
    return (
      <Box flexDirection="column">
        {tabs(ui, actions, model)}
        <Text dimColor>
          {watched.error === undefined ? 'загружается...' : `GitHub: ${watched.error}`}
        </Text>
      </Box>
    )
  }

  const open = openThreadsOf(data)
  const resolved = resolvedThreadsOf(data)
  const commits = data.commits.slice(-model.commitLimit).reverse()
  const bad = data.checks === null ? [] : data.checks.bad.slice(0, model.checkLimit)
  const columns = model.columns
  const fact = (name: string, value: string, color?: string) =>
    factRow(ui, columns, name, value, color)
  const reviewWord = decisionWord(data.reviews.decision) ?? 'не требуется'

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

      {fact('Ветки', `${data.headRefName} -> ${data.baseRefName}`)}
      {fact('Автор', data.author)}
      {fact(
        'Merge',
        data.mergeable === 'CONFLICTING'
          ? `${data.mergeStatus.toLowerCase()}, есть конфликты`
          : data.mergeStatus.toLowerCase(),
        mergeColor(data.mergeStatus),
      )}
      {data.checks === null
        ? fact('Проверки', 'нет')
        : fact(
            'Проверки',
            data.checks.required === 0
              ? `${data.checks.word} (${data.checks.total}, обязательных нет)`
              : `${data.checks.word} (обязательных ${data.checks.required} из ${data.checks.total})`,
            checksColor(data.checks.level),
          )}
      {hasReview(data)
        ? fact(
            'Ревью',
            data.reviews.approved.length === 0
              ? reviewWord
              : `${reviewWord}, апрувы: ${data.reviews.approved.join(', ')}`,
            reviewColor(data),
          )
        : <Box key="fact:review" />}
      {fact(
        'Треды',
        `${open.length} открытых из ${data.threads.length}`,
        open.length > 0 ? 'yellow' : 'green',
      )}
      {fact('Комментарии', String(data.comments))}
      {fact('Коммиты', String(data.commitsTotal))}
      {fact('Объём', `+${data.additions} -${data.deletions} / ${data.changedFiles}`)}
      {data.reviewers.length > 0 ? fact('Ревьюеры', data.reviewers.join(', ')) : <Box key="fact:rev" />}
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
          label={model.armedKey === watched.key ? 'треды ✓ в промпте' : 'треды в промпт'}
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

      {bad.length === 0 ? (
        <Box />
      ) : (
        <Box flexDirection="column">
          <Text bold>{`Не зелёные проверки (${data.checks?.bad.length ?? 0})`}</Text>
          {gap(ui, 'gap:checks')}
          {bad.map(check => checkRow(ui, check))}
          {gap(ui, 'gap:checks-end')}
        </Box>
      )}

      {resolved.length === 0 ? (
        <Box />
      ) : (
        <Box flexDirection="column">
          <Button
            key="toggle-resolved"
            label={`${model.showResolved ? '▾' : '▸'} Закрытые треды (${resolved.length})`}
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
          <Text bold>{`Коммиты (${data.commitsTotal})`}</Text>
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
        {`обновлено ${clock(watched.updatedMs)}${watched.error === undefined ? '' : ` · опрос не удался: ${watched.error}`}`}
      </Text>
    </Box>
  )
}
