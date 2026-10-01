// Сдача кода цели complete по санкции --pr (docs/tracks/deliver.md); не трек: ledger пишет главный поток, вход args { task, track, branch, base, draft, goal_path, cwd }.
export const meta = {
  name: 'dex-auto-deliver',
  description: 'Сдача кода цели complete: push ветки auto/<TASK> и PR/MR каналом хостинга, доступным в среде, - узел deliverer',
  phases: [
    { title: 'Deliver', detail: 'deliverer: push своей ветки без перезаписи, PR/MR в целевую ветку либо обновление открытого, описание из цели, последнего прогона и диффа' },
  ],
}

const A = args && typeof args === 'object' ? args : {}

// >>> shared: contract
const STATUS = { type: 'string', enum: ['complete', 'blocked', 'partial'] }
const VERDICT = { type: 'string', enum: ['APPROVE', 'REQUEST_CHANGES', 'NEEDS_DISCUSSION'] }
const lack = (v, who) => !v ? `${who} не вернул выход` : v.missing || `${who} вернул blocked без нехватки`
// Трек виден в списке / и зовётся без args: узлы с правом записи на пустом cwd работали бы в дереве сессии.
const unfed = (A, fields) => fields.filter(f => !String(A[f] ?? '').trim())
const why = (e) => String(e && e.message || e).slice(0, 300)
// <<< shared: contract
// >>> shared: nodes
// Цену узла ставит трек, frontmatter узла её не несёт; запись без model и effort - уровень сессии.
const NODE = {
  // sonnet - модель пробы в прогонах P76-P86.
  'goal-reader': { agentType: 'dex-auto:goal-reader', model: 'sonnet' },
  // opus - модель контроля dex-self-reviewer: сверка P74 различает норму, а не модель.
  reviewer: { agentType: 'dex-auto:reviewer', model: 'opus' },
  // без model - замера модели скептика нет (#289).
  skeptic: { agentType: 'dex-auto:skeptic' },
  // sonnet - модель кодеров каталога: сверка P75 различает норму, а не модель.
  coder: { agentType: 'dex-auto:coder', model: 'sonnet' },
  // opus - модель контроля dex-debugger: сверка P91 различает норму, а не модель.
  debugger: { agentType: 'dex-auto:debugger', model: 'opus' },
  // sonnet - узел исполняет публикацию по каналу хостинга, суждения о коде у него нет.
  deliverer: { agentType: 'dex-auto:deliverer', model: 'sonnet' },
}
// <<< shared: nodes

// Смысл полей - в файле узла (agents/deliverer.md), схема держит только форму.
const STR = { type: 'string' }
const OUT = { type: 'object', properties: { status: STATUS, url: STR, channel: STR, head: STR, missing: STR },
  required: ['status', 'url', 'channel', 'head', 'missing'] }
// reason уходит строкой шапки цели (`PR:`): перевод строки завёл бы в шапке ложное поле.
const done = (pr, reason, extra) => ({ pr, reason: reason.trim().replace(/\s*\n\s*/g, '; '), url: '', channel: '', head: '', ...extra })

const noStr = ['task', 'track', 'branch', 'goal_path', 'cwd'].filter(k => !A[k] || typeof A[k] !== 'string')
const shape = typeof args === 'string' ? 'args строкой, а не объектом'
  : noStr.length ? `пусто либо не строка: ${noStr.join(', ')}`
  : !['feature', 'bugfix'].includes(A.track) ? `трек «${A.track}», ждали feature либо bugfix`
  // Своя ветка трека - единственная, которую сдача вправе пушить (brd, стоп-линии); имя - как dx.branch_of.
  : A.branch !== `auto/${A.task.replace(/[^A-Za-z0-9-]/g, '-')}` ? `ветка ${A.branch} не ветка трека цели ${A.task}`
  : !/(^|\/)00-goal\.md$/.test(A.goal_path) ? `goal_path ${A.goal_path} не файл цели 00-goal.md`
  : A.base !== undefined && typeof A.base !== 'string' ? 'base не строка'
  : A.draft !== undefined && typeof A.draft !== 'boolean' ? 'draft не логическое' : ''
if (shape) return done('not-opened', `вход сдачи не разобран: ${shape}`)

const trackPath = A.goal_path.replace(/00-goal\.md$/, `01-${A.track}.md`)
const INPUT = [
  `TASK: ${A.task}. Ветка цели - ${A.branch}, рабочий каталог - ${A.cwd}.`,
  `Целевая ветка: ${A.base ? A.base : 'не названа'}. ${A.draft ? 'PR/MR - черновиком.' : 'PR/MR - готовым к ревью.'}`,
  `Цель - ${A.goal_path}, файл трека - ${trackPath}.`,
].join('\n')

phase('Deliver')
let d
try {
  d = await agent(INPUT, { label: 'deliver', phase: 'Deliver', schema: OUT, ...NODE.deliverer })
} catch (e) {
  return done('not-opened', `узел сдачи ${NODE.deliverer.agentType} не отработал: ${why(e)}`)
}
if (!d) return done('not-opened', 'узел сдачи не вернул выход')
const got = { channel: d.channel || '', head: d.head || '' }
if (d.status !== 'complete') return done('not-opened', d.missing || `узел сдачи вернул ${d.status} без нехватки`, got)
if (!d.url) return done('not-opened', 'узел сдачи вернул complete без адреса PR/MR', got)
return done('opened', '', { ...got, url: d.url })
