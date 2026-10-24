// Вход в проект (docs/tracks/onboard.md); ledger не пишет, вход args { cwd, brief, stack, scripts }.
export const meta = {
  name: 'dex-auto-onboard',
  description: 'Вход в проект: скелет пустого проекта - узел scaffolder, корпус и уровень 0 - узел onboarder, сверка дельты с кодом репозитория - узел corpus-checker',
  phases: [
    { title: 'Scaffold', detail: 'scaffolder и верификатор: технический скелет пустого проекта на стеке оператора, зелёный по сборке и тестам; только при поданном stack' },
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
// >>> shared: verify
const VERIFY = { type: 'object', properties: {
  status: STATUS,
  exit_code: { type: 'integer' }, pass_count: { type: 'integer' }, fail_count: { type: 'integer' },
  failing: { type: 'array', items: { type: 'string' } },
  flaky: { type: 'array', items: { type: 'string' }, description: 'упали в первом прогоне и прошли в повторе' },
  build_ok: { type: 'boolean' },
  head: { type: 'string', description: 'git log --oneline -3' },
  head_sha: { type: 'string', description: 'git rev-parse HEAD' },
  dirty: { type: 'boolean', description: 'git status --porcelain непустой' },
  ahead: { type: 'integer', description: 'коммитов ветки трека, которых нет ни на одной другой ветке' },
  delta: { type: ['array', 'null'], items: { type: 'string' }, description: 'места правки от delta_from до рабочего дерева: file:from-to, file:line, file; поля нет в JSON - null' },
  missing: { type: 'string', description: 'при blocked - почему прогон не выполнен; иначе пусто' },
}, required: ['status', 'exit_code', 'pass_count', 'fail_count', 'failing', 'build_ok', 'head', 'head_sha', 'dirty', 'ahead', 'delta', 'missing'] }
const AHEAD_CMD = 'git rev-list --count HEAD --not --exclude="$(git branch --show-current)" --branches'
const VERIFY_CMDS = `git log --oneline -3, git rev-parse HEAD (это head_sha), git status --porcelain и ${AHEAD_CMD} (это ahead)`
// Команды едут скрипту hex-строкой: кавычки и $ в команде проекта шелл модели не портит.
const hexOf = (s) => encodeURIComponent(s).replace(/%([0-9A-F]{2})|[^%]/g, (m, h) => h ? h.toLowerCase() : m.charCodeAt(0).toString(16).padStart(2, '0'))
// Команды ведёт кодер: подготовка снимает их до правки, и раннер, заведённый правкой, иначе не гонялся бы никогда.
const withCommands = (t, f) => {
  const c = (f && f.commands) || {}, build = String(c.build_cmd || '').trim(), test = String(c.test_cmd || '').trim()
  if (!t || (!build && !test)) return t
  return { ...t, ...(build ? { build_cmd: build } : {}), ...(test && test !== t.test_cmd ? { test_cmd: test, report_cmd: String(c.report_cmd || '').trim() } : {}) }
}
// test_cmd строки - действующая команда тестов, та, что гоняет verifySpec: report_cmd, иначе test_cmd. Одна test_cmd при заведённом report_cmd
// показала бы в «стало» не тот прогон, который верификация гоняла.
const cmdsOf = (t) => ({ build_cmd: String((t && t.build_cmd) || '').trim(), test_cmd: String((t && t.report_cmd) || '').trim() || String((t && t.test_cmd) || '').trim() })
// Созданная кодером на пустом месте команда строки не даёт: судить замену не с чем.
const swapText = (was, t) => {
  const now = cmdsOf(t), s = was ? ['build_cmd', 'test_cmd'].filter(k => was[k] && now[k] !== was[k]).map(k => `${k}: было «${was[k]}», стало «${now[k]}»`) : []
  return s.length ? `\nКодер заменил команды прогона: ${s.join('; ')}. Замена, сужающая охват прогона без причины в плане кодера, - находка.` : ''
}
const verifySpec = (t, known, extra) => ({ build: t.build_cmd || '', test: t.report_cmd || t.test_cmd || '', known: known || [], ...extra })
const verifyRun = (scripts, spec) => `Выполни командой Bash с timeout 600000: python3 '${scripts}/verify.py' ${hexOf(JSON.stringify(spec))}
stdout - JSON. status running - повтори python3 '${scripts}/verify.py' --wait <его out> тем же timeout, пока status не станет другим. Поля схемы перенеси из итогового JSON как есть; counts null - pass_count, fail_count и failing выведи из test_tail. Команда не вернула JSON - status blocked, в missing её вывод.`
// Верификатор, не сумевший прогнать, по exit_code неотличим от красных тестов: без этой ветки трек проедает потолок правок вхолостую.
const noRun = (v) => !v || v.status === 'blocked'
const freshFails = (v, known) => ((v && v.failing) || []).filter(f => !(known || []).includes(f))
// Падение базы правке не вменяется, но безымянное падение (exit не 0 при пустом failing) унаследованным не считается.
const isGreen = (v, testCmd, known) => !!v && v.build_ok && !v.dirty && !(testCmd && !(v.pass_count > 0)) && !freshFails(v, known).length
  && ((v.exit_code === 0 && v.fail_count === 0) || (v.failing.length > 0 && v.fail_count <= v.failing.length))
const inheritedFails = (v, known) => ((v && v.failing) || []).filter(f => (known || []).includes(f))
const redNote = (v, known) => `exit=${v.exit_code}, build_ok=${v.build_ok}, прошло тестов: ${v.pass_count}, новые падения: ${freshFails(v, known).join('; ') || 'нет'}${inheritedFails(v, known).length ? `, унаследованы от базы: ${inheritedFails(v, known).join('; ')}` : ''}, dirty=${v.dirty}`
const NO_SCRIPTS = 'каталог скриптов не подан (args.scripts): верификатор гоняет команды сам - без отчёта раннера и повтора нестабильных'
// Полный набор кодер гонял сам и следом его же гонял верификатор: на больших наборах это удваивало каждую попытку.
const COVER_ONLY = 'Гоняй тесты задетого правкой, полный набор не гоняй.'
// <<< shared: verify

// Смысл полей - в файлах узлов (agents/onboarder.md, agents/corpus-checker.md), схема держит только форму.
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
const ONBOARD = { type: 'object', properties: {
  status: STATUS,
  'corpus-status': { type: 'string', enum: ['found', 'deployed'] },
  layout: STRS,
  units: { type: 'array', items: { type: 'object', properties: { id: STR, path: STR, kind: STR, origin: { type: 'string', enum: ['source', 'derived'] }, trace: STR }, required: ['id', 'path', 'kind', 'origin', 'trace'] } },
  covered: { type: 'array', items: { type: 'object', properties: { id: STR, path: STR, what: STR }, required: ['id', 'path', 'what'] } },
  unrecorded: { type: 'array', items: { type: 'object', properties: { what: STR, reason: STR }, required: ['what', 'reason'] } },
  conflicts: STRS,
  map: { type: 'array', items: { type: 'object', properties: { path: STR, what: STR }, required: ['path', 'what'] } },
  rules: { type: 'array', items: { type: 'object', properties: { path: STR, what: STR }, required: ['path', 'what'] } },
  guards: { type: 'array', items: { type: 'object', properties: { path: STR, basis: STR }, required: ['path', 'basis'] } },
  commit: STR, decisions: STRS, missing: STR,
}, required: ['status', 'corpus-status', 'layout', 'units', 'covered', 'unrecorded', 'conflicts', 'map', 'rules', 'guards', 'commit', 'decisions', 'missing'] }
const SCAFFOLD = { type: 'object', properties: {
  status: STATUS, files: STRS, skipped: STRS, build_cmd: STR, test_cmd: STR, report_cmd: STR, commit: STR, decisions: STRS, missing: STR,
}, required: ['status', 'files', 'skipped', 'build_cmd', 'test_cmd', 'report_cmd', 'commit', 'decisions', 'missing'] }

const EMPTY = { scaffold: '', unverified: '', skipped: [], corpus: '', layout: [], units: [], derived: [], covered: [], unrecorded: [], conflicts: [], map: [], rules: [], guards: [], checks: [], missed: [], foreign: [], secrets: [], commit: '', decisions: [] }
const done = (status, gaps, extra) => ({ ...EMPTY, ...extra, status, where: gaps.join('; ') })

const notStr = ['brief', 'scripts'].find(f => A[f] !== undefined && typeof A[f] !== 'string')
const shape = typeof args === 'string' ? 'args строкой, а не объектом'
  : !args || typeof args !== 'object' ? 'args не объект'
  : typeof A.cwd !== 'string' || blank(A.cwd) ? 'cwd пуст либо не строка'
  : notStr ? `не строка: ${notStr}`
  : A.stack !== undefined && (typeof A.stack !== 'string' || blank(A.stack)) ? 'stack подан пустым либо не строкой' : ''
if (shape) return done('blocked', [`вход в проект не разобран: ${shape}`])

const INPUT = [`Рабочий каталог - ${A.cwd}.`, blank(A.brief) ? 'Описания продукта от оператора нет.' : `Описание продукта от оператора:\n${A.brief}`].join('\n')

const gaps = []
let sc = null
let scaffold = ''
if (A.stack !== undefined) {
  phase('Scaffold')
  try {
    sc = await agent(`${INPUT}\nПроект пуст. Стек оператора - ${A.stack}.\nPush не делать.`, { label: 'scaffold', phase: 'Scaffold', schema: SCAFFOLD, ...NODE.scaffolder })
  } catch (e) {
    return done('blocked', [`узел скелета ${NODE.scaffolder.agentType} не отработал: ${why(e)}`])
  }
  if (!sc) return done('blocked', ['скелетник не вернул выход'])
  const scGot = { unverified: sc.commit, skipped: sc.skipped, decisions: sc.decisions.map(d => `скелетник: ${d}`) }
  const scGap = `скелет: ${sc.missing || `скелетник вернул ${sc.status} без нехватки`}`
  if (sc.status === 'blocked') return done('blocked', [scGap], scGot)
  if (blank(sc.commit)) return done('blocked', ['скелет: коммита нет'], scGot)
  if (blank(sc.build_cmd) || blank(sc.test_cmd)) return done('blocked', ['скелет: нет команды сборки либо тестов'], scGot)
  const t = { build_cmd: sc.build_cmd, test_cmd: sc.test_cmd, report_cmd: sc.report_cmd }
  let v = null
  try {
    v = await agent(`Рабочий каталог - ${A.cwd}. Верификация скелета: ТОЛЬКО прогон и отчёт, код не менять. ${A.scripts ? `${verifyRun(A.scripts, verifySpec(t, []))}\nЗатем git status --porcelain: вывод непуст - dirty true.` : `Выполни ${t.build_cmd ? `сборку: ${t.build_cmd}; ` : ''}тесты: ${t.test_cmd}; затем ${VERIFY_CMDS}. Числа - из вывода раннера как есть.`}`,
      { label: 'verify:scaffold', phase: 'Scaffold', model: 'haiku', effort: 'low', schema: VERIFY })
  } catch (e) {
    return done('blocked', [`верификация скелета не состоялась: ${why(e)}`], scGot)
  }
  if (noRun(v)) return done('blocked', [`верификация скелета не состоялась: ${lack(v, 'верификатор')}`], scGot)
  if (!isGreen(v, t.test_cmd, [])) return done('blocked', [`скелет не зелёный: ${redNote(v, [])}`], scGot)
  if (sc.status === 'partial') gaps.push(scGap)
  scaffold = sc.commit
}
const SCAFFOLDED = sc ? `\nПроект был пуст: скелет на стеке оператора ${A.stack} - коммит ${scaffold} с трейлером \`Dex-Auto-Onboard: scaffold\`; выбор стека - слово оператора. Не заложено в скелет:\n${sc.skipped.map(s => `- ${s}`).join('\n') || 'нет'}` : ''
const SC = { scaffold, skipped: sc ? sc.skipped : [], decisions: sc ? sc.decisions.map(d => `скелетник: ${d}`) : [] }

phase('Onboard')
let on
try {
  on = await agent(`${INPUT}${SCAFFOLDED}\nPush не делать.`, { label: 'onboard', phase: 'Onboard', schema: ONBOARD, ...NODE.onboarder })
} catch (e) {
  return done('blocked', [`узел входа ${NODE.onboarder.agentType} не отработал: ${why(e)}`, ...gaps], SC)
}
if (!on) return done('blocked', ['составитель не вернул выход', ...gaps], SC)
const got = { ...SC, corpus: on['corpus-status'], layout: on.layout, units: on.units, derived: on.units.filter(u => u.origin === 'derived').map(u => u.id),
  covered: on.covered, unrecorded: on.unrecorded, conflicts: on.conflicts, map: on.map, rules: on.rules, guards: on.guards, commit: on.commit, decisions: [...SC.decisions, ...on.decisions] }
const onGap = `вход: ${on.missing || `составитель вернул ${on.status} без нехватки`}`
if (on.status === 'blocked') return done('blocked', [onGap, ...gaps], { ...got, corpus: '' })
if (on.status === 'partial') gaps.push(onGap)
if (on.conflicts.length) gaps.push(`корпус расходится с кодом: ${on.conflicts.join(' | ')}`)

const UNITS = on.units.map(u => `- ${u.id} ${u.kind}, ${u.path}, ${u.origin}, trace ${u.trace}`).join('\n') || 'нет'
const COVERED = on.covered.map(c => `- ${c.id}, ${c.path}: ${c.what}`).join('\n') || 'нет'
const SKIPPED = on.unrecorded.map(u => `- ${u.what}: ${u.reason}`).join('\n') || 'нет'
phase('Check')
let chk = null
let chkErr = 'сверщик не вернул выход'
try {
  chk = await agent([INPUT,
    'Предмет - раздел «Предмет входа», мест правки нет: предмет ищешь в коде и конфигурации репозитория. Трейлер коммитов составителя - `Dex-Auto-Onboard: yes`.' + (scaffold ? ` Коммит скелета ${scaffold} с трейлером \`Dex-Auto-Onboard: scaffold\` - не коммит составителя, его не судишь.` : ''),
    `Единицы дельты корпуса:\n${UNITS}\ncovered:\n${COVERED}\nunrecorded:\n${SKIPPED}\nКоммит составителя: ${on.commit || 'не назван'}.`].join('\n'),
  { label: 'check', phase: 'Check', schema: CHECK, ...NODE['corpus-checker'] })
} catch (e) {
  chkErr = `узел сверки ${NODE['corpus-checker'].agentType} не отработал: ${why(e)}`
}
if (!chk) return done('partial', [...gaps, `сверка дельты не состоялась: ${chkErr}`], got)
const all = { ...got, checks: chk.checks, missed: chk.missed, foreign: chk.foreign, secrets: chk.secrets, decisions: [...got.decisions, ...chk.decisions.map(d => `сверщик: ${d}`)] }
if (chk.foreign.length) return done('blocked', [`составитель тронул файлы вне корпуса: ${chk.foreign.join(', ')}`, ...gaps], all)
if (chk.secrets.length) return done('blocked', [`в корпусе значение секрета: ${chk.secrets.join(', ')}`, ...gaps], all)
const chkGap = `сверка: ${chk.missing || `сверщик вернул ${chk.status} без нехватки`}`
if (chk.status === 'blocked') return done('partial', [...gaps, chkGap], all)
if (chk['corpus-status'] === 'absent') gaps.push(`корпус: составитель - ${on['corpus-status']}, сверщик - absent: ${chk['corpus-basis']}`)
if (chk.status === 'partial') gaps.push(chkGap)
gaps.push(...checkGaps(on.units, chk))
return done(gaps.length ? 'partial' : 'complete', gaps, all)
