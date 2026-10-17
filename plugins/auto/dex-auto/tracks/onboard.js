// Вход в проект (docs/tracks/onboard.md); ledger не пишет, вход args { cwd, brief }.
export const meta = {
  name: 'dex-auto-onboard',
  description: 'Вход в проект: корпус и уровень 0 - узел onboarder, сверка дельты с кодом репозитория - узел corpus-checker',
  phases: [
    { title: 'Onboard', detail: 'onboarder: корпус найден либо развёрнут, назначение продукта и решения устройства единицами review, один локальный коммит' },
    { title: 'Check', detail: 'corpus-checker: каждая единица против кода, предмет входа без единицы, файлы вне корпуса в коммите составителя' },
  ],
}

const A = args && typeof args === 'object' ? args : {}

// >>> shared: blank
const blank = (v) => !String(v || '').trim()
// <<< shared: blank
// >>> shared: contract
const STATUS = { type: 'string', enum: ['complete', 'blocked', 'partial'] }
const VERDICT = { type: 'string', enum: ['APPROVE', 'REQUEST_CHANGES', 'NEEDS_DISCUSSION'] }
const lack = (v, who) => !v ? `${who} не вернул выход` : v.missing || `${who} вернул blocked без нехватки`
// Трек виден в списке / и зовётся без args: узлы с правом записи работали бы без цели и каталога.
const unfed = (A, fields) => fields.filter(f => !String(A[f] ?? '').trim())
const why = (e) => String(e && e.message || e).slice(0, 300)
// <<< shared: contract
// >>> shared: nodes
// Цену узла ставит трек, frontmatter узла её не несёт; запись без model и effort - уровень сессии.
const NODE = {
  // sonnet - модель пробы в прогонах P76-P86 и P95.
  'goal-reader': { agentType: 'dex-auto:goal-reader', model: 'sonnet' },
  // opus - модель контроля dex-self-reviewer: сверка P74 различает норму, а не модель.
  reviewer: { agentType: 'dex-auto:reviewer', model: 'opus' },
  // без model - замера модели скептика нет (#289).
  skeptic: { agentType: 'dex-auto:skeptic' },
  // opus - устройство по цене судится до кода, его реализует кодер на sonnet (P114).
  designer: { agentType: 'dex-auto:designer', model: 'opus' },
  // без model - замера модели фиксатора нет.
  recorder: { agentType: 'dex-auto:recorder' },
  // без model - замера модели сверщика нет.
  'corpus-checker': { agentType: 'dex-auto:corpus-checker' },
  // без model - замера модели составителя входа нет.
  onboarder: { agentType: 'dex-auto:onboarder' },
  // sonnet - модель кодеров каталога: сверка P75 различает норму, а не модель.
  coder: { agentType: 'dex-auto:coder', model: 'sonnet' },
  // opus - модель контроля dex-debugger: сверка P91 различает норму, а не модель.
  debugger: { agentType: 'dex-auto:debugger', model: 'opus' },
  // sonnet - узел исполняет публикацию по каналу хостинга, суждения о коде у него нет.
  deliverer: { agentType: 'dex-auto:deliverer', model: 'sonnet' },
}
// <<< shared: nodes

// Смысл полей - в файлах узлов (agents/onboarder.md, agents/corpus-checker.md), схема держит только форму.
// >>> shared: corpus-check
const STR = { type: 'string' }
const STRS = { type: 'array', items: STR }
const CORPUS = { type: 'string', enum: ['present', 'absent'] }
const CHECK = { type: 'object', properties: {
  status: STATUS, 'corpus-status': CORPUS, 'corpus-basis': STR,
  checks: { type: 'array', items: { type: 'object', properties: { id: STR, verdict: { type: 'string', enum: ['upheld', 'contradicted', 'unverifiable'] }, evidence: STR }, required: ['id', 'verdict', 'evidence'] } },
  missed: { type: 'array', items: { type: 'object', properties: { where: STR, what: STR }, required: ['where', 'what'] } },
  foreign: STRS, decisions: STRS, missing: STR,
}, required: ['status', 'corpus-status', 'corpus-basis', 'checks', 'missed', 'foreign', 'decisions', 'missing'] }
const checkGaps = (units, chk) => {
  const byId = new Map(chk.checks.map(c => [c.id, c]))
  const unheld = units.map(u => byId.get(u.id) || { id: u.id, verdict: 'без вердикта', evidence: 'сверщик промолчал' })
    .filter(c => c.verdict !== 'upheld').map(c => `${c.id} - ${c.verdict}: ${c.evidence}`)
  return [unheld.length && `единица не подтверждена сверкой: ${unheld.join(' | ')}`,
    chk.missed.length && `предмет без единицы корпуса: ${chk.missed.map(m => `${m.where} - ${m.what}`).join(' | ')}`].filter(Boolean)
}
// <<< shared: corpus-check
const ONBOARD = { type: 'object', properties: {
  status: STATUS,
  'corpus-status': { type: 'string', enum: ['found', 'deployed'] },
  layout: STRS,
  units: { type: 'array', items: { type: 'object', properties: { id: STR, path: STR, kind: STR, origin: { type: 'string', enum: ['source', 'derived'] }, trace: STR }, required: ['id', 'path', 'kind', 'origin', 'trace'] } },
  covered: { type: 'array', items: { type: 'object', properties: { id: STR, path: STR, what: STR }, required: ['id', 'path', 'what'] } },
  unrecorded: { type: 'array', items: { type: 'object', properties: { what: STR, reason: STR }, required: ['what', 'reason'] } },
  conflicts: STRS, commit: STR, decisions: STRS, missing: STR,
}, required: ['status', 'corpus-status', 'layout', 'units', 'covered', 'unrecorded', 'conflicts', 'commit', 'decisions', 'missing'] }

const EMPTY = { corpus: '', layout: [], units: [], derived: [], covered: [], unrecorded: [], conflicts: [], checks: [], missed: [], foreign: [], commit: '', decisions: [] }
const done = (status, gaps, extra) => ({ ...EMPTY, ...extra, status, where: gaps.join('; ') })

const shape = typeof args === 'string' ? 'args строкой, а не объектом'
  : !args || typeof args !== 'object' ? 'args не объект'
  : typeof A.cwd !== 'string' || blank(A.cwd) ? 'cwd пуст либо не строка'
  : A.brief !== undefined && typeof A.brief !== 'string' ? 'не строка: brief' : ''
if (shape) return done('blocked', [`вход в проект не разобран: ${shape}`])

const INPUT = [`Рабочий каталог - ${A.cwd}.`, blank(A.brief) ? 'Описания продукта от оператора нет.' : `Описание продукта от оператора:\n${A.brief}`].join('\n')

phase('Onboard')
let on
try {
  on = await agent(`${INPUT}\nPush не делать.`, { label: 'onboard', phase: 'Onboard', schema: ONBOARD, ...NODE.onboarder })
} catch (e) {
  return done('blocked', [`узел входа ${NODE.onboarder.agentType} не отработал: ${why(e)}`])
}
if (!on) return done('blocked', ['составитель не вернул выход'])
const got = { corpus: on['corpus-status'], layout: on.layout, units: on.units, derived: on.units.filter(u => u.origin === 'derived').map(u => u.id),
  covered: on.covered, unrecorded: on.unrecorded, conflicts: on.conflicts, commit: on.commit, decisions: on.decisions }
const onGap = `вход: ${on.missing || `составитель вернул ${on.status} без нехватки`}`
if (on.status === 'blocked') return done('blocked', [onGap], { ...got, corpus: '' })
const gaps = on.status === 'partial' ? [onGap] : []
if (on.conflicts.length) gaps.push(`корпус расходится с кодом: ${on.conflicts.join(' | ')}`)

const UNITS = on.units.map(u => `- ${u.id} ${u.kind}, ${u.path}, ${u.origin}, trace ${u.trace}`).join('\n') || 'нет'
const COVERED = on.covered.map(c => `- ${c.id}, ${c.path}: ${c.what}`).join('\n') || 'нет'
const SKIPPED = on.unrecorded.map(u => `- ${u.what}: ${u.reason}`).join('\n') || 'нет'
phase('Check')
let chk = null
let chkErr = 'сверщик не вернул выход'
try {
  chk = await agent([INPUT,
    'Предмет - раздел «Предмет входа», мест правки нет: предмет ищешь в коде и конфигурации репозитория. Трейлер коммитов составителя - `Dex-Auto-Onboard: yes`.',
    `Единицы дельты корпуса:\n${UNITS}\ncovered:\n${COVERED}\nunrecorded:\n${SKIPPED}\nКоммит составителя: ${on.commit || 'не назван'}.`].join('\n'),
  { label: 'check', phase: 'Check', schema: CHECK, ...NODE['corpus-checker'] })
} catch (e) {
  chkErr = `узел сверки ${NODE['corpus-checker'].agentType} не отработал: ${why(e)}`
}
if (!chk) return done('partial', [...gaps, `сверка дельты не состоялась: ${chkErr}`], got)
const all = { ...got, checks: chk.checks, missed: chk.missed, foreign: chk.foreign, decisions: [...on.decisions, ...chk.decisions.map(d => `сверщик: ${d}`)] }
if (chk.foreign.length) return done('blocked', [`составитель тронул файлы вне корпуса: ${chk.foreign.join(', ')}`, ...gaps], all)
const chkGap = `сверка: ${chk.missing || `сверщик вернул ${chk.status} без нехватки`}`
if (chk.status === 'blocked') return done('partial', [...gaps, chkGap], all)
if (chk['corpus-status'] === 'absent') gaps.push(`корпус: составитель - ${on['corpus-status']}, сверщик - absent: ${chk['corpus-basis']}`)
if (chk.status === 'partial') gaps.push(chkGap)
gaps.push(...checkGaps(on.units, chk))
return done(gaps.length ? 'partial' : 'complete', gaps, all)
