// Which tools of the catalog the session has, and what the mod does where one
// is missing. The mod hands real work - a statement of the task, an
// implementation, a review - to the catalog's own commands when they are
// installed, because they carry norms the mod does not copy. Where one is not,
// the mod falls back to a brief of its own that does the same job more plainly
// and says so, so a missing plugin never turns into a silent no-op.
//
// Pure: the commands the session lists come in as data.

export type Role = 'spec' | 'implement' | 'selfReview' | 'review' | 'github' | 'gitlab'

export type Need = {
  role: Role
  title: string
  /** The slash command that does the job, without the slash. */
  command: string
  /** The catalog plugin that brings it. */
  plugin: string
  /** What the mod does without it. */
  fallback: string
}

export const MARKETPLACE = 'dex-claude-marketplace'

export const NEEDS: readonly Need[] = [
  {
    role: 'spec',
    title: 'постановка задачи',
    command: 'feature',
    plugin: 'dex-business-analyst',
    fallback: 'встроенный шаблон постановки (контекст, объём, критерии приёмки, вопросы)',
  },
  {
    role: 'implement',
    title: 'реализация по постановке',
    command: 'implement',
    plugin: 'dex-implement',
    fallback: 'встроенное поручение: ветка, малые правки с проверкой, локальные коммиты',
  },
  {
    role: 'selfReview',
    title: 'саморевью до push',
    command: 'self-review',
    plugin: 'dex-self-reviewer',
    fallback: 'без саморевью: проверки проекта перед сдачей остаются в поручении',
  },
  {
    role: 'review',
    title: 'ревью чужого PR/MR',
    command: 'mr-review',
    plugin: 'dex-mr-reviewer',
    fallback: 'без ревью из мода',
  },
  {
    role: 'github',
    title: 'слежение за PR (GitHub)',
    command: 'pr',
    plugin: 'dex-github-pr-tracker',
    fallback: 'ссылку на PR мод просто выдаёт в транскрипт, без панели',
  },
  {
    role: 'gitlab',
    title: 'слежение за MR (GitLab)',
    command: 'mr',
    plugin: 'dex-gitlab-mr-tracker',
    fallback: 'ссылку на MR мод просто выдаёт в транскрипт, без панели',
  },
]

export type CommandRef = { name: string; plugin?: string }

export type Found = Need & {
  installed: boolean
  /** The command as the session names it, when installed. */
  actual: string
}

/** `plugin:command` and `/command` both mean `command`. */
const bare = (name: string) => name.replace(/^\//, '').split(':').pop() ?? name

/**
 * Commands of the catalog by role. `overrides` carries what the person set for
 * the two commands the mod sends work to (`implementCommand`, `reviewCommand`):
 * another plugin may provide them under another name.
 */
export function detectTools(
  commands: readonly CommandRef[],
  overrides: Partial<Record<Role, string>> = {},
): Found[] {
  return NEEDS.map(need => {
    const wanted = (overrides[need.role] ?? '').trim() || need.command
    const hit = commands.find(
      command =>
        bare(command.name) === bare(wanted) &&
        // `pr` and `mr` are generic names: a command that says which plugin it
        // came from must be the tracker, anything else is somebody else's `pr`.
        (need.role !== 'github' && need.role !== 'gitlab'
          ? true
          : command.plugin === undefined || command.plugin.includes(need.plugin)),
    )

    return { ...need, command: wanted, installed: hit !== undefined, actual: hit ? bare(hit.name) : '' }
  })
}

export const toolOf = (found: readonly Found[], role: Role): Found => {
  const hit = found.find(item => item.role === role)

  if (hit === undefined) throw new Error(`нет роли ${role}`)

  return hit
}

export const installLine = (plugin: string) => `claude plugin install ${plugin}@${MARKETPLACE}`

export type Hosts = { gh: boolean; glab: boolean }

/** `/jira tools`: a line per role, what answers it and what would be installed. */
export function toolsText(found: readonly Found[], hosts: Hosts): string {
  const lines = found.map(item =>
    item.installed
      ? `- ${item.title}: /${item.actual} (${item.plugin})`
      : `- ${item.title}: не установлено - ${item.fallback}. Поставить: \`${installLine(item.plugin)}\``,
  )
  const missing = found.filter(item => !item.installed)

  return [
    'Инструменты, которым мод передаёт работу:',
    ...lines,
    '',
    `Клиенты хостингов: gh - ${hosts.gh ? 'есть' : 'нет'}, glab - ${hosts.glab ? 'есть' : 'нет'} (нужны для открытия PR/MR).`,
    missing.length === 0
      ? 'Всё установлено.'
      : '`/jira tools install` поставит недостающее (`all` или роль: spec, implement, selfReview, review, github, gitlab); после установки перечитайте плагины.',
  ].join('\n')
}

/** Roles named by `/jira tools install <what>`: `all` is every missing one. */
export function installTargets(found: readonly Found[], what: string): Found[] | null {
  const missing = found.filter(item => !item.installed)

  if (what === 'all') return missing

  const hit = missing.find(item => item.role.toLowerCase() === what.toLowerCase())

  return hit === undefined ? (found.some(item => item.role.toLowerCase() === what.toLowerCase()) ? [] : null) : [hit]
}
