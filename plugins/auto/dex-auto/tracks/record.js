// Фиксация истины после доведённой правки (docs/tracks/record.md); ledger не пишет, вход args { cwd, goal_path | goal, source, base, task }.
export const meta = {
  name: 'dex-auto-record',
  description: 'Фиксация истины: дельта корпуса проекта на ветке цели - узел recorder, сверка дельты с кодом ветки - узел corpus-checker',
  phases: [
    { title: 'Record', detail: 'recorder: единицы корпуса на изменение поведения и решения правки, статус review, один локальный коммит' },
    { title: 'Check', detail: 'corpus-checker: каждая единица против кода ветки, предмет без единицы, файлы вне корпуса в коммите фиксатора' },
  ],
}

const A = args && typeof args === 'object' ? args : {}

// >>> shared: blank
const blank = (v) => !String(v || '').trim()
// <<< shared: blank
// >>> shared: owner-side
const ownerSide = 'Пункт критерия «готово» или границы с пометкой «ответ оператора» - сторона, выбранная оператором: расхождение источника с ним противоречием не судится и в conflicts не идёт.'
// <<< shared: owner-side
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
  // без model - замера модели скелетника нет.
  scaffolder: { agentType: 'dex-auto:scaffolder' },
  // sonnet - модель кодеров каталога: сверка P75 различает норму, а не модель.
  coder: { agentType: 'dex-auto:coder', model: 'sonnet' },
  // opus - модель контроля dex-debugger: сверка P91 различает норму, а не модель.
  debugger: { agentType: 'dex-auto:debugger', model: 'opus' },
  // sonnet - узел исполняет публикацию по каналу хостинга, суждения о коде у него нет.
  deliverer: { agentType: 'dex-auto:deliverer', model: 'sonnet' },
}
// <<< shared: nodes

// Смысл полей - в файлах узлов (agents/recorder.md, agents/corpus-checker.md), схема держит только форму.
// >>> shared: corpus-check
const STR = { type: 'string' }
const STRS = { type: 'array', items: STR }
const CORPUS = { type: 'string', enum: ['present', 'absent'] }
const CHECK = { type: 'object', properties: {
  status: STATUS, 'corpus-status': CORPUS, 'corpus-basis': STR,
  checks: { type: 'array', items: { type: 'object', properties: { id: STR, verdict: { type: 'string', enum: ['upheld', 'contradicted', 'unverifiable'] }, evidence: STR }, required: ['id', 'verdict', 'evidence'] } },
  missed: { type: 'array', items: { type: 'object', properties: { where: STR, what: STR }, required: ['where', 'what'] } },
  foreign: STRS, secrets: STRS, decisions: STRS, missing: STR,
}, required: ['status', 'corpus-status', 'corpus-basis', 'checks', 'missed', 'foreign', 'secrets', 'decisions', 'missing'] }
const checkGaps = (units, chk) => {
  const ids = new Set(units.map(u => u.id))
  // Строк под одним id бывает несколько: единица подтверждена, только если все они upheld.
  const unheld = units.flatMap(u => {
    const own = chk.checks.filter(c => c.id === u.id)
    return own.length ? own.filter(c => c.verdict !== 'upheld') : [{ id: u.id, verdict: 'без вердикта', evidence: 'строки сверщика с этим id нет' }]
  }).map(c => `${c.id} - ${c.verdict}: ${c.evidence}`)
  // Иначе вердикт под id вне единиц (диапазон у составителя) пропал бы молча.
  const stray = chk.checks.filter(c => !ids.has(c.id)).map(c => c.verdict === 'upheld' ? `${c.id} - upheld` : `${c.id} - ${c.verdict}: ${c.evidence}`)
  return [unheld.length && `единица не подтверждена сверкой: ${unheld.join(' | ')}`,
    stray.length && `вердикт сверщика по id вне единиц: ${stray.join(' | ')}`,
    chk.missed.length && `предмет без единицы корпуса: ${chk.missed.map(m => `${m.where} - ${m.what}`).join(' | ')}`].filter(Boolean)
}
// <<< shared: corpus-check
const RECORD = { type: 'object', properties: {
  status: STATUS,
  'corpus-status': CORPUS,
  units: { type: 'array', items: { type: 'object', properties: { id: STR, path: STR, kind: STR, action: { type: 'string', enum: ['added', 'edited'] }, origin: { type: 'string', enum: ['source', 'derived'] }, trace: STR }, required: ['id', 'path', 'kind', 'action', 'origin', 'trace'] } },
  covered: { type: 'array', items: { type: 'object', properties: { id: STR, path: STR, what: STR }, required: ['id', 'path', 'what'] } },
  unrecorded: { type: 'array', items: { type: 'object', properties: { what: STR, reason: STR }, required: ['what', 'reason'] } },
  conflicts: STRS, commit: STR, decisions: STRS, missing: STR,
}, required: ['status', 'corpus-status', 'units', 'covered', 'unrecorded', 'conflicts', 'commit', 'decisions', 'missing'] }

const EMPTY = { corpus: '', na: '', units: [], derived: [], covered: [], unrecorded: [], conflicts: [], checks: [], missed: [], foreign: [], secrets: [], commit: '', decisions: [] }
const done = (status, gaps, extra) => ({ ...EMPTY, ...extra, status, where: gaps.join('; ') })

const badType = ['goal_path', 'goal', 'source', 'base', 'task'].filter(k => A[k] !== undefined && typeof A[k] !== 'string')
const shape = typeof args === 'string' ? 'args строкой, а не объектом'
  : !args || typeof args !== 'object' ? 'args не объект'
  : typeof A.cwd !== 'string' || blank(A.cwd) ? 'cwd пуст либо не строка'
  : badType.length ? `не строка: ${badType.join(', ')}`
  : blank(A.goal_path) && blank(A.goal) ? 'постановки нет: ни goal_path, ни goal' : ''
if (shape) return done('blocked', [`вход фиксации не разобран: ${shape}`])

// >>> shared: own-commits
const OWN_COMMITS = 'git rev-list HEAD --not --exclude="$(git branch --show-current)" --branches'
// <<< shared: own-commits
const OWN = `git diff "$(${OWN_COMMITS} | tail -1)^" HEAD, своих коммитов нет - git diff HEAD`
const INPUT = [
  `${blank(A.task) ? '' : `TASK: ${A.task}. `}Рабочий каталог - ${A.cwd}.`,
  blank(A.goal_path) ? `Цель:\n${A.goal}` : `Цель - файл ${A.goal_path}; решения прогонов по ней - файлы 01-*.md рядом с ним, если есть.`,
  blank(A.source) ? 'Источник требований не назван.' : `Источник требований: ${A.source}.`,
  `Места правки: ${blank(A.base) ? OWN : `git diff ${A.base}...HEAD; ${A.base} не найден - ${OWN}`}.`,
].join('\n')

phase('Record')
let rec
try {
  rec = await agent(`${INPUT}\n${ownerSide}\nPush не делать.`, { label: 'record', phase: 'Record', schema: RECORD, ...NODE.recorder })
} catch (e) {
  return done('blocked', [`узел фиксации ${NODE.recorder.agentType} не отработал: ${why(e)}`])
}
if (!rec) return done('blocked', ['фиксатор не вернул выход'])
const got = { corpus: rec['corpus-status'], units: rec.units, derived: rec.units.filter(u => u.origin === 'derived').map(u => u.id),
  covered: rec.covered, unrecorded: rec.unrecorded, conflicts: rec.conflicts, commit: rec.commit, decisions: rec.decisions }
const recGap = `фиксация: ${rec.missing || `фиксатор вернул ${rec.status} без нехватки`}`
if (rec.status === 'blocked') return done('blocked', [recGap], { ...got, corpus: '' })
if (rec['corpus-status'] === 'absent') {
  if (rec.units.length || rec.commit) return done('blocked', ['фиксатор вернул corpus-status absent с дельтой корпуса'], got)
  if (rec.status !== 'complete') return done('partial', [recGap], got)
}
const gaps = rec.status === 'partial' ? [recGap] : []
if (rec.conflicts.length) return done('blocked', [`противоречие принятой единице корпуса: ${rec.conflicts.join(' | ')}`, ...gaps], got)

const UNITS = rec.units.map(u => `- ${u.id} ${u.kind}, ${u.path}, ${u.action}, ${u.origin}, trace ${u.trace}`).join('\n') || 'нет'
const COVERED = rec.covered.map(c => `- ${c.id}, ${c.path}: ${c.what}`).join('\n') || 'нет'
const SKIPPED = rec.unrecorded.map(u => `- ${u.what}: ${u.reason}`).join('\n') || 'нет'
phase('Check')
let chk = null
let chkErr = 'сверщик не вернул выход'
try {
  chk = await agent(`${INPUT}\nПредмет - раздел «Предмет фиксации». Трейлер коммитов фиксатора - \`Dex-Auto-Record: yes\`.\nЕдиницы дельты корпуса:\n${UNITS}\ncovered:\n${COVERED}\nunrecorded:\n${SKIPPED}\nКоммит фиксатора: ${rec.commit || 'не назван'}.`,
    { label: 'check', phase: 'Check', schema: CHECK, ...NODE['corpus-checker'] })
} catch (e) {
  chkErr = `узел сверки ${NODE['corpus-checker'].agentType} не отработал: ${why(e)}`
}
if (!chk) return done('partial', [...gaps, `сверка дельты не состоялась: ${chkErr}`], got)
const all = { ...got, checks: chk.checks, missed: chk.missed, foreign: chk.foreign, secrets: chk.secrets, decisions: [...rec.decisions, ...chk.decisions.map(d => `сверщик: ${d}`)] }
if (chk.foreign.length) return done('blocked', [`фиксатор тронул файлы вне корпуса: ${chk.foreign.join(', ')}`, ...gaps], all)
if (chk.secrets.length) return done('blocked', [`в корпусе значение секрета: ${chk.secrets.join(', ')}`, ...gaps], all)
const chkGap = `сверка: ${chk.missing || `сверщик вернул ${chk.status} без нехватки`}`
if (chk.status === 'blocked') return done('partial', [...gaps, chkGap], all)
if (chk['corpus-status'] !== rec['corpus-status']) gaps.push(`корпус: фиксатор - ${rec['corpus-status']}, сверщик - ${chk['corpus-status']}: ${chk['corpus-basis']}`)
if (chk.status === 'partial') gaps.push(chkGap)
gaps.push(...checkGaps(rec.units, chk))
const na = rec['corpus-status'] === 'absent' && chk['corpus-status'] === 'absent' ? 'корпуса нет: фиксация n/a' : ''
return done(gaps.length ? 'partial' : 'complete', gaps, { ...all, na })
