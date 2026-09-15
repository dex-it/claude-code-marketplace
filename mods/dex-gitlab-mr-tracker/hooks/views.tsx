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

import type { MrData, Thread } from './gitlab'
import { approvalsGiven, threadTally } from './gitlab'
import type { Watched } from './watched'
import { openThreadsOf, plainThreadsOf, resolvedThreadsOf } from './watched'

export type Ui = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
  Link: ElementConstructor<LinkProps>
}

export type Actions = {
  select: (key: string) => void
  openUrl: (url: string) => void
  refresh: (key: string) => void
  /** Arms the MR's open threads to ride the next prompt as context. */
  ask: (key: string) => void
  stop: (key: string) => void
  toggleResolved: () => void
}

export type PaneModel = {
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

const MERGE_RED = new Set([
  'blocked_status',
  'broken_status',
  'conflict',
  'merge_request_blocked',
  'need_rebase',
  'requested_changes',
  'security_policy_violations',
])

const MERGE_GRAY = new Set(['draft_status', 'not_open'])

const PIPELINE_COLOR: Record<string, string> = {
  success: 'green',
  failed: 'red',
  canceled: 'red',
  skipped: 'gray',
  manual: 'gray',
  scheduled: 'gray',
}

const mergeColor = (status: string) =>
  status === 'mergeable' || status === 'can_be_merged'
    ? 'green'
    : MERGE_RED.has(status)
      ? 'red'
      : MERGE_GRAY.has(status)
        ? 'gray'
        : 'yellow'

const pipelineColor = (status: string) => PIPELINE_COLOR[status] ?? 'yellow'

const stateWord = (data: MrData) =>
  data.state === 'opened' && data.draft ? 'draft' : data.state

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
      <Box display="none" hover={{ display: 'flex' }} flexShrink={0} flexDirection="row">
        <Button
          key={`open:${watched.key}`}
          label="открыть"
          onPress={() => actions.openUrl(data.webUrl)}
        />
        <Button
          key={`pane:${watched.key}`}
          label="детали"
          onPress={() => actions.select(watched.key)}
        />
        <Button key={`stop:${watched.key}`} label="×" onPress={() => actions.stop(watched.key)} />
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

function threadRow(ui: Ui, thread: Thread): RenderElement {
  const { Box, Text, Link } = ui

  const where =
    thread.file === null
      ? 'обсуждение MR'
      : `${thread.file}${thread.line === null ? '' : `:${thread.line}`}`

  return (
    <Box key={`thread:${thread.id}`} flexDirection="column">
      <Box flexDirection="row">
        <Box flexShrink={0}>
          <Text color={thread.resolved ? 'green' : 'yellow'}>
            {thread.resolved ? '✓ ' : '● '}
          </Text>
        </Box>
        <Box flexShrink={0}>
          <Link href={thread.url} label={where} />
        </Box>
        <Text dimColor wrap="truncate-end">
          {` ${thread.author}, ✎${thread.notes}${thread.lastAuthor === thread.author ? '' : `, последний ${thread.lastAuthor}`}`}
        </Text>
      </Box>
      <Box flexDirection="row">
        <Box flexShrink={0}>
          <Text>{'   '}</Text>
        </Box>
        <Text wrap="truncate-end">{thread.body}</Text>
      </Box>
    </Box>
  )
}

/** The whole MR: what the row leaves out, and every thread by file and line. */
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

  return (
    <Box flexDirection="column">
      {tabs(ui, actions, model)}
      <Text bold wrap="truncate-end">{data.title}</Text>
      <Box flexDirection="row">
        <Box flexShrink={0}>
          <Link href={data.webUrl} label={watched.label} />
        </Box>
        <Text wrap="truncate-end">
          <Text color={STATE_COLOR[data.state] ?? 'gray'}>{` ${stateWord(data)}`}</Text>
          <Text dimColor>{` · ${data.sourceBranch} → ${data.targetBranch} · ${data.author}`}</Text>
        </Text>
      </Box>
      <Text wrap="truncate-end">
        <Text dimColor>{'merge '}</Text>
        <Text color={mergeColor(data.mergeStatus)}>{data.mergeStatus}</Text>
        {data.hasConflicts ? <Text color="red">{' · конфликты'}</Text> : <Text />}
        {data.pipeline === null ? (
          <Text dimColor>{' · пайплайна нет'}</Text>
        ) : (
          <Text>
            <Text dimColor>{' · ci '}</Text>
            <Text color={pipelineColor(data.pipeline.status)}>{data.pipeline.status}</Text>
          </Text>
        )}
        {approvals === null ? (
          <Text />
        ) : (
          <Text>
            <Text dimColor>{' · апрувы '}</Text>
            <Text color={approvals.left === 0 || approvalsGiven(approvals) > 0 ? 'green' : 'yellow'}>
              {`${approvalsGiven(approvals)}${approvals.required === null ? '' : `/${approvals.required}`}`}
            </Text>
            <Text dimColor>{approvals.by.length === 0 ? '' : ` (${approvals.by.join(', ')})`}</Text>
          </Text>
        )}
      </Text>
      <Text dimColor wrap="truncate-end">
        {[
          `треды ${open.length}/${threadTally(data.threads).resolvable}`,
          `комментариев ${data.notesCount}`,
          `коммитов ${data.commits.length}${data.commitsCapped ? '+' : ''}`,
          data.changesCount === '' ? null : `файлов ${data.changesCount}`,
          data.upvotes + data.downvotes > 0 ? `↑${data.upvotes} ↓${data.downvotes}` : null,
          data.reviewers.length > 0 ? `ревью: ${data.reviewers.join(', ')}` : null,
          data.labels.length > 0 ? `метки: ${data.labels.join(', ')}` : null,
        ]
          .filter((part): part is string => part !== null)
          .join(' · ')}
      </Text>
      <Box flexDirection="row" flexWrap="wrap">
        <Button
          key={`pane-open:${watched.key}`}
          label="открыть в браузере"
          onPress={() => actions.openUrl(data.webUrl)}
        />
        <Text>{' '}</Text>
        <Button
          key={`pane-refresh:${watched.key}`}
          label={watched.busy ? 'обновляется' : 'обновить'}
          onPress={() => actions.refresh(watched.key)}
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
      <Text bold>
        {open.length === 0 ? 'Открытых тредов нет' : `Открытые треды (${open.length})`}
      </Text>
      {open.map(thread => threadRow(ui, thread))}
      {plain.length === 0 ? (
        <Box />
      ) : (
        <Box flexDirection="column">
          <Text bold>{`Обсуждение MR (${plain.length})`}</Text>
          {plain.map(thread => threadRow(ui, thread))}
        </Box>
      )}
      {resolved.length === 0 ? (
        <Box />
      ) : (
        <Box flexDirection="column">
          <Box flexDirection="row">
            <Button
              key="toggle-resolved"
              label={`${model.showResolved ? '▾' : '▸'} Закрытые треды (${resolved.length})`}
              dimColor
              onPress={() => actions.toggleResolved()}
            />
          </Box>
          {model.showResolved ? (
            <Box flexDirection="column">
              {resolved.map(thread => threadRow(ui, thread))}
            </Box>
          ) : (
            <Box />
          )}
        </Box>
      )}
      {commits.length === 0 ? (
        <Box />
      ) : (
        <Box flexDirection="column">
          <Text bold>{`Коммиты (${data.commits.length}${data.commitsCapped ? '+' : ''})`}</Text>
          {commits.map(commit => (
            <Text key={`commit:${commit.sha}`} dimColor wrap="truncate-end">
              {`${commit.sha} ${commit.title} - ${commit.author}`}
            </Text>
          ))}
        </Box>
      )}
      <Text dimColor wrap="truncate-end">
        {`обновлено ${clock(watched.updatedMs)}${watched.error === undefined ? '' : ` · опрос не удался: ${watched.error}`}`}
      </Text>
    </Box>
  )
}
