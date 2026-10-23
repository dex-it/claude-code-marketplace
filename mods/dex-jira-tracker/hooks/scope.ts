// Which issues the mod follows, as JQL. Pure: the string builders are settled
// by tests, the CLI call stays in backend.ts.
//
// jira-cli puts every `-q` query into the context of one project (`-p`, else
// the one `jira init` saved) and appends its own `ORDER BY`. So the queries
// here carry no project clause, and a custom query must not carry an ORDER BY:
// the CLI would write a second one after it and Jira would refuse the whole.

export type Scope = 'project' | 'mine' | 'sprint' | 'jql'

export const SCOPES: readonly Scope[] = ['project', 'mine', 'sprint', 'jql']

export const SCOPE_WORD: Record<Scope, string> = {
  project: 'весь проект',
  mine: 'мои задачи',
  sprint: 'открытые спринты',
  jql: 'свой JQL',
}

export const scopeOf = (value: string, fallback: Scope): Scope =>
  SCOPES.find(scope => scope === value) ?? fallback

/** A project key as Jira writes it; also what keeps the `-p` argument from being anything else. */
export const PROJECT_RE = /^[A-Za-z][A-Za-z0-9_]*$/

export type Queries = {
  /** Everything followed: open issues, and those updated within `doneDays`, closed or not. */
  base: string
  /** Keys of the issues that are not done: whatever is outside this set among the base is closed. */
  open: string
  /** The ones whose status category is "In Progress", whatever the workflow calls the status. */
  progress: string
  /** The open ones assigned to the person the CLI is signed in as. */
  mine: string
}

export type QueriesInput = {
  scope: Scope
  /** The custom query, read when `scope` is `jql`. */
  jql: string
  /** Days a closed issue stays in the list; 0 - it leaves at once. */
  doneDays: number
}

export type QueriesResult = { queries: Queries; reason?: undefined } | { queries?: undefined; reason: string }

// The status category, not `resolution`: a workflow may close an issue without
// setting a resolution (a "Closed" status that leaves it empty is common), and
// then `resolution = Unresolved` calls every closed issue open. The category is
// what Jira itself draws the status colour from.
const NOT_DONE = 'statusCategory != Done'

const and = (...parts: readonly string[]) =>
  parts
    .filter(part => part.trim() !== '')
    .map(part => `(${part})`)
    .join(' AND ')

export function queriesOf(input: QueriesInput): QueriesResult {
  let filter = ''

  if (input.scope === 'mine') filter = 'assignee = currentUser()'
  else if (input.scope === 'sprint') filter = 'sprint in openSprints()'
  else if (input.scope === 'jql') {
    const custom = input.jql.trim()

    if (custom === '') {
      return { reason: 'scope jql выбран, а настройка jql пуста: впишите запрос' }
    }

    if (/\border\s+by\b/i.test(custom)) {
      return { reason: 'в jql не нужен ORDER BY: jira-cli дописывает свой, и запрос не разберётся' }
    }

    filter = custom
  }

  const days = Math.max(0, Math.floor(input.doneDays))
  const window = days === 0 ? NOT_DONE : `${NOT_DONE} OR updated >= -${days}d`

  return {
    queries: {
      base: and(filter, window),
      open: and(filter, NOT_DONE),
      progress: and(filter, 'statusCategory = "In Progress"'),
      mine: and(filter, NOT_DONE, 'assignee = currentUser()'),
    },
  }
}

/** The project key that most of the issues carry: the label when no setting names one. */
export function projectOfKeys(keys: readonly string[]): string {
  const count = new Map<string, number>()

  for (const key of keys) {
    const prefix = key.slice(0, key.lastIndexOf('-'))

    count.set(prefix, (count.get(prefix) ?? 0) + 1)
  }

  let best = ''
  let most = 0

  for (const [prefix, n] of count) {
    if (n > most) {
      best = prefix
      most = n
    }
  }

  return best
}
