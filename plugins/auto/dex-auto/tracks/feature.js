// Трек feature как Workflow-скрипт (artifacts.md, O12 вариант A; форма проверена probes.md P9, P11).
// Вход через args: { task, goal, done, boundary, mode, cwd, source, goal_path, resume, trail, open_findings, ctx }.
// Обязательства формы: status первым полем каждой схемы; потолки петель в скрипте; схема несёт
// поле под каждую часть контракта узла; нумерацию единиц отдаёт узел контекста.
export const meta = {
  name: 'dex-auto-feature',
  description: 'Трек feature: контекст R/I параллельно подготовке дерева -> правка с верификацией (потолок 3) -> саморевью -> правка по находкам (потолок 2) со сверкой правки',
  phases: [
    { title: 'Context', detail: 'параллельно: R/I из цели, кода и корпуса документации проекта и подготовка дерева - зависимости по манифесту стека, сборка и тесты до правок' },
    { title: 'Implement', detail: 'узел-кодер x верификация внешним фактом, потолок 3; при возобновлении - сначала верификация' },
    { title: 'Review', detail: 'саморевью со скептиком; находки, держащие порог, - правка с верификацией и сверка правки по её дельте; ревью одно, правок по находкам до 2' },
  ],
}

const A = args || {}
const FIX_CEILING = 3, REVIEW_FIX_CEILING = 2
// Каталог, стоп-линии и отсутствие оператора одинаковы для любого узла трека; цель и критерий
// несёт только тот, кто их исполняет.
const TREE = `Рабочий каталог - ${A.cwd} на текущей ветке, процесс уже в нём; всё незакоммиченное в нём - от этой работы. Ветку не переключай. Push, деплой, миграции данных и удаление вне рабочего каталога не делать - это стоп-линия. Оператора нет: невыводимое не додумывай, верни status: blocked с полем нехватки.\n`
// >>> shared: blank
const blank = (v) => !String(v || '').trim()
// <<< shared: blank
// >>> shared: owner-side
const ownerSide = 'Пункт критерия «готово» или границы с пометкой «ответ оператора» - сторона, выбранная оператором: расхождение источника с ним противоречием не судится и в conflicts не идёт.'
// <<< shared: owner-side
// >>> shared: goal-args
// Главный поток может не подать done и boundary: узел берёт их из файла цели, пропуск - в degraded
const fromGoal = (v, absent, section, dflt) => !blank(v) ? v : A.goal_path ? `${absent}, возьми из раздела \`## ${section}\` файла цели ${A.goal_path}` : dflt
const goalLack = [blank(A.done) && 'критерий «готово» не подан', blank(A.boundary) && 'граница не подана'].filter(Boolean)
  .map(s => `${s} в args: ${A.goal_path ? `узлы отосланы к файлу цели ${A.goal_path}` : 'файла цели нет'}`)
// <<< shared: goal-args
const HEAD = `mode: ${A.mode || 'autonomous'}\nцель (${A.task}): ${A.goal}\nкритерий «готово»: ${fromGoal(A.done, 'не подан', 'Критерий «готово»', 'не подан')}\nграница: ${fromGoal(A.boundary, 'не подана', 'Граница', 'не выходить за рабочий каталог')}\nфайл цели: ${A.goal_path || 'нет'}\ndecision-log: n/a (трек журнал решений не ведёт; решения - полем decisions)\n${TREE}`
// Узел подготовки цели не получает: прочитав её первой строкой, он реализует фичу целиком, и
// хвостовой запрет его не держит (зонд P25). Предмет узла - дерево, и шапка несёт только его.
const PREP_HEAD = `mode: ${A.mode || 'autonomous'}\nзадача (${A.task}): подготовить рабочий каталог к сборке и тестам - и только это. Цель трека тебе не передана намеренно: реализацию ведёт другой узел, и код в каталоге не твой предмет.\n${TREE}`
// Возобновление - это «продолжить» плюс след прошлого прогона: без следа прогона не было, и возобновлять нечего.
const resuming = !!(A.resume && A.trail)
// Нехватку прошлого прогона и ответ на неё дерево не хранит: без них возобновление прошло бы мимо разрыва, на котором встал прогон.
const priorMissing = resuming ? String(A.prior_missing || '').trim() : ''
const goalDecisions = resuming ? (Array.isArray(A.goal_decisions) ? A.goal_decisions.join('\n') : String(A.goal_decisions || '')).trim() : ''
const RESUMED = `${priorMissing ? `\nПрошлый прогон не довёл: ${priorMissing}` : ''}${goalDecisions ? `\nРешения по цели (оператор и прошлые прогоны):\n${goalDecisions}` : ''}`
const DONE = resuming ? `\nВозобновление: шаги ниже уже сделаны (из ledger), не повторяй их, продолжай с незакрытого:\n${A.trail}${RESUMED}\n` : ''

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
// >>> shared: domain
const SEV = { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'], description: 'P0 = CRITICAL, P1 = HIGH, P2 = MEDIUM, P3 = LOW' }
const AXIS = { type: 'string', enum: ['security', 'architecture', 'language', 'business', 'regressions', 'performance', 'coverage', 'loose-ends', 'non-code'] }
const AXIS_OUTCOME = ['findings', 'clean', 'unverifiable', 'n/a']
const AXES = { type: 'array', items: { type: 'object', properties: { name: AXIS, outcome: { type: 'string', enum: AXIS_OUTCOME }, checked: { type: 'string' } }, required: ['name', 'outcome', 'checked'] } }
// Трек судит форму набора осей и её согласие с findings, верность исхода судит скептик.
const axesGap = (axes, findings) => {
  const a = axes || []
  const unnamed = AXIS.enum.filter(n => !a.some(x => x.name === n && x.outcome))
  const count = (n) => (findings || []).filter(f => f.axis === n).length
  return [unnamed.length ? `оси не названы: ${unnamed.join(', ')}` : '',
    ...a.filter(x => x.outcome === 'unverifiable').map(x => `ось не проверена: ${x.name} - ${x.checked || 'причина не названа'}`),
    ...(findings ? a.filter(x => (x.outcome === 'findings') !== count(x.name) > 0).map(x => `исход оси расходится с findings: ${x.name} - ${x.outcome}, находок оси ${count(x.name)}`) : [])].filter(Boolean).join('; ')
}
const ROOT_VERDICT = ['legitimate', 'illegitimate', 'none']
// Исход сверки - enum: опровергнутое утверждение трек находит полем, а не словом в прозе.
const FACT_STATUS = ['verified', 'unverifiable', 'contradicted']
const FACT_CHECK = (subject) => ({ type: 'array', items: { type: 'object', properties: { claim: { type: 'string' }, status: { type: 'string', enum: FACT_STATUS }, source: { type: 'string', description: 'verified и contradicted - источник; unverifiable - где искал' } }, required: ['claim', 'status', 'source'] }, description: `запись на каждое утверждение предмета, взятое по памяти; предмет - ${subject}; таких утверждений нет - пустой перечень` })
const ROOTS = { type: 'array', items: { type: 'object', properties: { anchor: { type: 'string', description: 'место решения: file:line, file:from-to либо file' }, decision: { type: 'string' }, root: { type: 'string', description: 'проблема, требование или ограничение, которое решение закрывает, с источником' }, verdict: { type: 'string', enum: ROOT_VERDICT }, evidence: { type: 'string' }, finding: { type: 'string', description: 'у illegitimate - ref находки этого выхода либо id прежней, которой поднят дефект решения; иначе пусто' } }, required: ['anchor', 'decision', 'root', 'verdict', 'evidence', 'finding'] }, description: 'запись на каждое решение правки; место правки без решения - verdict none' }
// Нелегитимное решение без открытой находки ушло бы из выхода вердиктом без дефекта, который можно закрыть; у находки ревьюера статуса нет.
const stillOpen = (f) => !f.status || OPEN_FINDING.includes(f.status)
// Узлы называют одно место строкой, диапазоном или файлом: строковое равенство якорей разводит их в разные места.
const spot = (a) => { const s = String(a || '').trim().replace(/:$/, ''), m = /^(.+?):(\d+)(?:-(\d+))?(?::\d+)?$/.exec(s); return m ? [m[1], Math.min(+m[2], +(m[3] || m[2])), Math.max(+m[2], +(m[3] || m[2]))] : [s, 0, Infinity] }
const sameSpot = (a, b) => { const [fa, a1, a2] = spot(a), [fb, b1, b2] = spot(b); return fa !== '' && fa === fb && a1 <= b2 && b1 <= a2 }
const atFinding = (f, a) => [f.anchor, ...(f.places || [])].some(p => sameSpot(p, a))
// Узлы сшиваются номером находки: якорь уезжает правкой, скептик переставляет его на место механизма; без номера - по месту.
const sameFinding = (x, f) => x.ref && f.ref ? x.ref === f.ref : sameSpot(x.anchor, f.anchor)
const hasFinding = (x, found) => (found || []).some(f => stillOpen(f) && (!!x.finding && [f.ref, f.id].includes(x.finding) || atFinding(f, x.anchor)))
const rootsGap = (roots, found) => {
  const bare = (roots || []).filter(x => x.verdict === 'illegitimate' && !hasFinding(x, found)).map(x => x.anchor)
  return bare.length ? `решение нелегитимно без находки: ${bare.join(', ')}` : ''
}
// Форма одна у всех ревьюеров: ledger хранит находку одной записью, и поле, которого нет у одного узла, из реестра выпадает молча.
const FINDING = { type: 'object', properties: {
  ref: { type: 'string', description: 'номер находки в выходе: у ревьюера R1, R2...; у скептика в confirmed - ref подтверждаемой находки ревьюера, своя находка - пусто' },
  anchor: { type: 'string', description: 'file:line' }, places: { type: 'array', items: { type: 'string' } }, severity: SEV, axis: AXIS,
  text: { type: 'string' }, closure: { type: 'string', description: 'критерий закрытия' }, evidence: { type: 'string' },
  premise: { type: 'string', description: 'посылка, которую не доказали ни код, ни прогон, и проба, которая её проверит; посылка доказана - пусто' },
}, required: ['ref', 'anchor', 'places', 'severity', 'axis', 'text', 'closure', 'evidence', 'premise'] }
// Узел выносит статус из PRIOR_STATUS; unverified и dropped ставит только трек. Перечень реестра держат и dexauto.py с finish.py - сверяет sync-tracks --check.
const PRIOR_STATUS = ['closed', 'partial', 'open', 'disputed', 'no-longer-applicable']
const OPEN_FINDING = ['open', 'partial', 'unverified']
const FINDING_STATUS = [...OPEN_FINDING, 'closed', 'disputed', 'no-longer-applicable', 'dropped']
// Прежняя находка опознаётся по id реестра ledger: без него finish.sh заводит её новой, и разность «открытые» двоится.
const PRIOR = { type: 'object', properties: {
  id: { type: 'string', description: 'id находки из перечня; находки в перечне нет - её место в findings, не здесь' },
  anchor: FINDING.properties.anchor, places: FINDING.properties.places, severity: SEV, axis: { type: 'string', description: 'ось из перечня; не названа - пусто' }, text: { type: 'string' },
  status: { type: 'string', enum: PRIOR_STATUS }, evidence: { type: 'string' },
  premise: { type: 'string', description: 'посылка находки, всё ещё не доказанная, с пробой; доказана кодом, прогоном либо ответом оператора в цели - пусто' },
}, required: ['id', 'anchor', 'severity', 'axis', 'text', 'status', 'evidence', 'premise'] }
const isOpen = (f) => OPEN_FINDING.includes(f.status)
const isBlocking = (f) => f.severity === 'P0' || f.severity === 'P1'
// Предикаты находки - docs/domain.md §2.
// P2, внесённая правкой по находкам, - убыток самой правки: правится, пока идут круги; итог держат только P0/P1 (P115).
const holds = (f) => isOpen(f) && (isBlocking(f) || !!f.introduced && f.severity === 'P2')
// Исход такой находки решает проба оператора, а не правка: кодер по ней покупал круг за кругом на недостижимом пути.
const awaitsProbe = (f) => !!String(f.premise || '').trim()
// Правка сверх порога рискует достигнутым ради необязательного: правка по P2 о скорости перестроила механизм и внесла регрессию.
const toFix = (f) => holds(f) && !awaitsProbe(f)
const offered = (f) => isOpen(f) && !holds(f) && !awaitsProbe(f)
const asks = (f) => isOpen(f) && !isBlocking(f) && (f.severity === 'P2' || awaitsProbe(f))
// Дельта не получена - внесённой считается любая новая находка: молча отложить убыток правки дороже лишнего вопроса.
const introducedAt = (delta) => (f) => !Array.isArray(delta) || delta.some(d => atFinding(f, d))
const priorLine = (p) => `- ${p.id || p.ref ? `${p.id || p.ref} ` : ''}[${p.severity}] ${p.axis ? `${p.axis} ` : ''}${p.anchor}: ${p.text}${(p.places || []).length ? ` (также: ${p.places.join(', ')})` : ''}${awaitsProbe(p) ? ` (проба: ${p.premise})` : ''}`
const findingLine = (f) => `${priorLine(f)}${f.closure ? ` (закрытие: ${f.closure})` : ''}${f.evidence ? `\n  улика: ${f.evidence}` : ''}`
// Опознание - по id (ledger.md R10): строка сдвигается правкой, а на одной строке бывают разные находки. Статус прежней - последний, вынесенный узлом; о которой узел промолчал, та остаётся непроверенной.
// id записей, которые узел закрыл в своём выходе (статус не из открытых).
const shutBy = (r) => (r.prior || []).filter(p => p.id && !isOpen(p)).map(p => p.id)
// Номер реестра, от которого трек выдаёт id новым находкам (ledger.md R10); выход несёт его, и finish.sh принимает выданные id только при совпадении с реестром.
const FINDINGS_TOP = /^\d+$/.test(String(args?.findings_top ?? '').trim()) ? Number(args.findings_top) : null
const TOP_OUT = FINDINGS_TOP === null ? {} : { findings_top: FINDINGS_TOP }
function registry(unsettled) {
  const list = []
  // Закрытые в этом прогоне - в перечне ревью после правки: правка, вернувшая закрытое, иначе прошла бы молча.
  const closedHere = new Set()
  // Новой находке - постоянный F<n> с рождения: N<k> переводил бы finish.sh, а текст выхода с ним уже не сходится.
  const top = FINDINGS_TOP
  if (top === null) degraded.push(`findings_top не подан (${args?.findings_top ?? 'пусто'}): новые находки прогона - N<k>, в реестре finish.sh заведёт им F<n> с ref`)
  let minted = 0
  const mint = () => top === null ? `N${++minted}` : `F${top + ++minted}`
  const at = (id) => id ? list.findIndex(q => q.id === id) : -1
  const seat = (p, status, evidence) => {
    const i = at(p.id)
    // Важность записи только растёт: P2, поднятая узлом до P1, держит порог допуска.
    const base = i < 0 ? { id: p.id || mint(), anchor: p.anchor || '', places: p.places || [], severity: p.severity || '', axis: p.axis || '', text: p.text || '', closure: p.closure || '', premise: p.premise || '', ...(p.introduced ? { introduced: true } : {}) }
      : { ...list[i], severity: p.severity && (!list[i].severity || p.severity < list[i].severity) ? p.severity : list[i].severity, premise: 'premise' in p ? p.premise || '' : list[i].premise || '', places: (p.places || []).length ? p.places : list[i].places || [], ...(p.introduced ? { introduced: true } : {}) }
    const rec = { ...base, status: FINDING_STATUS.includes(status) ? status : 'unverified', evidence: FINDING_STATUS.includes(status) ? evidence : `статус вне словаря реестра (${status}): ${evidence}` }
    if (rec.status === 'closed') closedHere.add(rec.id)
    if (i < 0) list.push(rec); else list[i] = rec
    return rec.id
  }
  // Страховка от промаха узла: молча склеивает только якорь с той же непустой осью, совпавший один якорь - на вид.
  // Запись, которую узел в этом же выходе закрыл, он назвал сам: находка на её месте - другая, склейка отменила бы его статус и потеряла её суть.
  const take = (fs, who, known = list.slice(), shut = []) => {
    return (fs || []).map(f => {
      const hit = known.find(q => q.anchor === f.anchor && q.axis && q.axis === f.axis && !shut.includes(q.id))
      if (hit) { degraded.push(`${who}: находка ${hit.id} (${f.anchor}) подана новой - узел не назвал id, опознана по якорю и оси`); return { f, id: hit.id } }
      const near = known.find(q => q.anchor === f.anchor)
      if (near) degraded.push(`${who}: находка ${f.anchor} (${f.axis || 'ось не названа'}) - возможный дубль ${near.id}, заведена отдельно`)
      return { f, id: '' }
    })
  }
  return {
    seat, take, mint, all: () => list.slice(), open: () => list.filter(isOpen),
    holding: () => list.filter(holds), fixes: () => list.filter(toFix), offers: () => list.filter(offered), asking: () => list.filter(asks),
    closed: () => list.filter(f => f.status === 'closed' && closedHere.has(f.id)),
    listing: () => list.filter(f => isOpen(f) || closedHere.has(f.id)),
    doubt: (p) => seat(p, 'unverified', !p.evidence || p.evidence === unsettled ? unsettled : p.evidence.startsWith(`${unsettled}; `) ? p.evidence : `${unsettled}; ${p.evidence}`),
    // Опознание - только в перечне, поданном узлу; статус из blocked-выхода не принимается, но его новые находки не теряются.
    // introducedAt - предикат «внесена правкой» ревью после правки по находкам; у прочих ревью его нет.
    apply: (r, who, listed = list.slice(), introducedAt = null) => {
      if (!r) return
      const blocked = r.status === 'blocked'
      if (!blocked) for (const p of r.prior || []) {
        if (!p.id || !listed.some(q => q.id === p.id)) degraded.push(`${who}: запись prior ${p.id || 'без id'} (${p.anchor}) не из перечня - статус не принят`)
        else seat(introducedAt && closedHere.has(p.id) && ['open', 'partial'].includes(p.status) ? { ...p, introduced: true } : p, p.status, p.evidence)
      }
      for (const { f, id } of take(r.findings, who, listed, blocked ? [] : shutBy(r))) if (!id) seat(introducedAt && introducedAt(f) ? { ...f, introduced: true } : f, 'open', f.evidence); else if (!blocked) seat({ ...f, id, ...(introducedAt && closedHere.has(id) ? { introduced: true } : {}) }, 'open', f.evidence)
    },
  }
}
// Не-complete без места и нехватки оператору не действенен, а finish.sh пишет цели пустую нехватку: инвариант держит конструктор, не каждый выход.
const outcome = (status, where, missing, extra) => status === 'complete'
  ? { status, where: '', missing: '', loops, trail, degraded, ...TOP_OUT, ...extra }
  : { status, where: where || 'место не названо', missing: missing || `${where || 'шаг не назван'}: нехватка не названа`, loops, trail, degraded, ...TOP_OUT, ...extra }
// Узел каталога может быть не установлен: тогда general-purpose с ролью в промпте, факт - в degraded (graceful degradation).
async function node(role, prompt, opts, type) {
  if (type) {
    try { const r = await agent(prompt, { ...opts, agentType: type }); return r }
    catch (e) {
      // Причина обрыва платформой не типизирована: узел мог не существовать, а мог упасть посреди работы. Замена получает причину и сверяет уже сделанное.
      const w = why(e)
      degraded.push(`${role}: ${type} не отработал (${w})`); log(`узел ${type} не отработал, general-purpose`)
      return agent(`Роль: ${role}.\nУзел ${type} на этом шаге оборвался ошибкой: ${w}. Прежде чем действовать, сверь git log и рабочее дерево: сделанное им не повторяй и не коммить второй раз.\n${prompt}`, { ...opts, agentType: 'general-purpose' })
    }
  }
  return agent(`Роль: ${role}.\n${prompt}`, { ...opts, agentType: 'general-purpose' })
}
// Узел dex-auto заменой не страхуется: у general-purpose нет его нормы.
async function own(role, prompt, opts, spec) {
  try { return await agent(prompt, { ...opts, ...spec }) }
  catch (e) { degraded.push(`${role}: ${spec.agentType} не отработал (${why(e)})`); log(`узел ${spec.agentType} не отработал`); return null }
}
// Поля возобновления ledger.py печатает строкой JSON, а главный поток подаёт их как есть либо разобранными.
const fromLedger = (v) => { if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch (e) { return null } }
// Непригодный реестр прогон не останавливает (записи ledger без события прогона открыты сами), но и complete не выпускает: его P0/P1 трек не видел.
let ledgerUnread = false
const LEDGER_UNREAD = 'реестр прежних находок не прочитан - открытые P0/P1 прошлого прогона не сверены'
const ledgerList = (v, lost) => {
  if (v === undefined || v === null || v === '') return []
  const list = fromLedger(v)
  if (!Array.isArray(list)) { ledgerUnread = true; degraded.push(`поле open_findings не JSON-массив реестра ledger - ${lost}`); return [] }
  return list.filter(f => f && typeof f === 'object')
}
// <<< shared: domain
// >>> shared: falsify
const AXIS_CHECK = ['upheld', 'overturned']
// Исход оси ревьюера - claim: ось clean/n/a без записи скептика ушла бы в выход чистой непроверенной.
const axesCheckGap = (axes, check, confirmed) => {
  const c = check || []
  const unchecked = (axes || []).filter(a => ['clean', 'n/a'].includes(a.outcome) && !c.some(x => x.name === a.name)).map(a => a.name)
  const bare = c.filter(x => x.verdict === 'overturned' && !(confirmed || []).some(f => f.axis === x.name && stillOpen(f))).map(x => x.name)
  return [unchecked.length ? `исход оси не сверен скептиком: ${unchecked.join(', ')}` : '', bare.length ? `ось опровергнута без находки: ${bare.join(', ')}` : ''].filter(Boolean).join('; ')
}
const ROOT_CHECK = ['upheld', 'overturned']
// Вердикт по решению - claim в обе стороны, а overturned у legitimate и illegitimate значит противоположное: запись сверки - на одно решение.
const rootsCheckGap = (roots, check, found) => {
  const r = (roots || []).filter(x => x.verdict !== 'none')
  // Решения ревьюера пересекаются между собой: запись с местом решения иначе задела бы и соседнее.
  const exact = (y) => r.filter(x => String(spot(x.anchor)) === String(spot(y.anchor)))
  const hits = (check || []).map(y => [y, exact(y).length ? exact(y) : r.filter(x => sameSpot(y.anchor, x.anchor))])
  const wide = hits.filter(([, xs]) => xs.length > 1).map(([y]) => y.anchor)
  const own = (x) => hits.filter(([, xs]) => xs.length === 1 && xs[0] === x).map(([y]) => y)
  const unchecked = r.filter(x => !own(x).length).map(x => x.anchor)
  const bare = r.filter(x => own(x).some(y => (x.verdict === 'legitimate') === (y.verdict === 'overturned')) && !hasFinding(x, found)).map(x => x.anchor)
  return [wide.length ? `запись сверки покрывает несколько решений: ${wide.join(', ')}` : '', unchecked.length ? `решение не сверено скептиком: ${unchecked.join(', ')}` : '', bare.length ? `решение нелегитимно после сверки без находки: ${bare.join(', ')}` : ''].filter(Boolean).join('; ')
}
// Решение, которого ревьюер не назвал (и под none тоже), сверка его записей не видит - его называет скептик этим полем; запись на месте названного решения - спор о его вердикте, его судит roots-check.
const rootsMissedGap = (missed, roots) => {
  const bare = (missed || []).filter(x => !(roots || []).some(r => r.verdict !== 'none' && sameSpot(r.anchor, x.anchor)))
  return bare.length ? `решение не перечислено ревьюером: ${bare.map(x => `${x.anchor} - ${x.decision}`).join('; ')}` : ''
}
// Находка ревьюера - claim: молчание скептика о ней убрало бы её из реестра без следа.
const silentGap = (findings, fal) => {
  const seen = [...(fal.confirmed || []), ...(fal.dropped || []), ...(fal.prior || [])]
  const bare = (findings || []).filter(f => !seen.some(x => sameFinding(x, f))).map(f => f.anchor)
  return bare.length ? `находка не сверена скептиком: ${bare.join(', ')}` : ''
}
// Места правки снимает не ревьюер: перечень, собранный тем, чью полноту он проверяет, ничего не проверяет.
const hunkList = (hunks) => (hunks || []).length ? `\nМеста правки (без тестов) - каждое пересекает запись roots: решение либо none с причиной:\n${hunks.map(h => `- ${h}`).join('\n')}` : ''
const bareHunks = (hunks, roots) => (hunks || []).filter(h => !(roots || []).some(x => sameSpot(h, x.anchor)))
const hunkGap = (hunks, roots) => {
  const bare = bareHunks(hunks, roots)
  return bare.length ? `место правки без записи roots: ${bare.join(', ')}` : ''
}
// Правила проекта ищет узел снимка, читает ревьюер: прочтение - поле выдачи, иначе непрочитанное правило неотличимо от соблюдённого.
const CONVENTIONS = {
  conventions: { type: 'array', items: { type: 'string' }, description: 'пути от корня репозитория: документы, которыми проект нормирует код и ревью; не нашёл - пусто' },
  'conventions-searched': { type: 'string', description: 'где искал правила проекта' },
}
const CONVENTIONS_READ = { type: 'array', items: { type: 'string' }, description: 'пути из правил проекта во входе, прочитанные до суждения' }
const conventionsAsk = 'Правила проекта - conventions: документы, предписывающие, каким быть коду и ревью: CLAUDE.md, AGENTS.md и аналоги в корне и на пути к изменённым файлам, названное ими нормой, гайды вклада и стиля, ADR. Не правила: конфиги сборки и линтера, заметки, которые проект нормой не называет. conventions-searched - где искал.'
const conventionsOf = (x) => x && x.status !== 'blocked' ? x.conventions || [] : []
// Прочитанное называется путём из поданного перечня: свободную строку разведка и ревьюер пишут разной формой, и прочитанное правило числится непрочитанным.
const conventionsRead = (x) => conventionsOf(x).length ? { ...CONVENTIONS_READ, items: { type: 'string', enum: [...new Set(conventionsOf(x))] } } : CONVENTIONS_READ
const conventionsText = (x) => !x || x.status === 'blocked' ? '' : conventionsOf(x).length
  ? `\nПравила проекта - прочитай каждое до суждения: нарушение правила - находка, в evidence путь и ключ либо цитата правила; где правило расходится с отраслевой нормой о форме кода, судит правило:\n${conventionsOf(x).map(c => `- ${c}`).join('\n')}`
  : `\nПравил проекта не найдено (искали: ${x['conventions-searched'] || 'не названо'}).`
const conventionsGap = (x, rev) => {
  const path = (c) => String(c).trim().replace(/^\.\//, '')
  const read = ((rev && rev['conventions-read']) || []).map(path)
  const unread = conventionsOf(x).filter(c => !read.includes(path(c)))
  return unread.length ? `правила проекта не прочитаны: ${unread.join(', ')}` : ''
}
const axesText = (axes) => (axes || []).map(a => `- ${a.name}: ${a.outcome}${a.checked ? ` - ${a.checked}` : ''}`).join('\n') || '- не названы'
const rootsText = (roots) => (roots || []).map(x => `- ${x.anchor}: ${x.decision} - корень: ${x.root} - ${x.verdict}${x.finding ? ` (находка ${x.finding})` : ''}${x.evidence ? ` - ${x.evidence}` : ''}`).join('\n') || '- не названы'
const FALSIFY = { type: 'object', properties: {
  status: STATUS,
  confirmed: { type: 'array', items: FINDING },
  dropped: { type: 'array', items: { type: 'object', properties: { ref: { type: 'string', description: 'ref снимаемой находки ревьюера' }, anchor: { type: 'string' }, reason: { type: 'string' } }, required: ['ref', 'anchor', 'reason'] } },
  coverage: { type: 'string', description: 'вердикт по покрытию изменённого поведения: непокрытые ветки поимённо либо "покрыто: <чем>"' },
  'axes-check': { type: 'array', items: { type: 'object', properties: { name: AXIS, verdict: { type: 'string', enum: AXIS_CHECK }, evidence: { type: 'string' } }, required: ['name', 'verdict', 'evidence'] } },
  'roots-check': { type: 'array', items: { type: 'object', properties: { anchor: { type: 'string' }, verdict: { type: 'string', enum: ROOT_CHECK }, evidence: { type: 'string' } }, required: ['anchor', 'verdict', 'evidence'] } },
  'roots-missed': { type: 'array', items: { type: 'object', properties: { anchor: { type: 'string' }, decision: { type: 'string' } }, required: ['anchor', 'decision'] } },
  'review-verdict': VERDICT,
  prior: { type: 'array', items: PRIOR, description: 'сверенный с кодом статус каждой прежней находки перечня; прежних нет - пусто' },
  missing: { type: 'string' },
}, required: ['status', 'confirmed', 'dropped', 'coverage', 'axes-check', 'roots-check', 'roots-missed', 'review-verdict', 'prior', 'missing'] }
// <<< shared: falsify
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
// >>> shared: prep
// Техконтекст выводится из манифеста, а не из цели: его отдаёт дешёвый узел подготовки, следующие узлы получают команды готовыми.
const PREP = { type: 'object', properties: {
  status: STATUS,
  stack: { type: 'string', description: 'идентификатор стека по реестру (Skill dex-skill-stack-registry:stack-registry); вне реестра - "other"' },
  stack_basis: { type: 'string', description: 'манифест, из которого выведен стек (путь:строка); манифеста нет - чем определено иначе' },
  test_cmd: { type: 'string', description: 'команда прогона тестов; нет тестов - пустая строка' },
  report_cmd: { type: 'string', description: 'test_cmd со встроенным флагом раннера, пишущим отчёт JUnit XML либо TRX в $DEX_AUTO_JUNIT_DIR; такой флаг не известен наверняка - пустая строка' },
  build_cmd: { type: 'string', description: 'команда сборки/типизации; нет - пустая строка' },
  prepare_cmd: { type: 'string', description: 'команда подготовки дерева до сборки; подготовка не нужна - пустая строка' },
  // Enum: «дерево готово» и «готовить нечего» ведут к разному промпту дальше, а провал установки пустой строкой неотличим от успеха до первой сборки.
  'prepare-status': { type: 'string', enum: ['done', 'not-needed', 'failed'], description: 'done - команда вернула 0; not-needed - prepare_cmd пуст; failed - команда вернула не 0 либо не запущена' },
  prepare_log: { type: 'string', description: 'при done - код возврата, чем подтверждено и возвращённые пути; при failed - команда и последние строки вывода; при not-needed - почему готовить нечего' },
  missing: { type: 'string', description: 'при blocked - чего не хватает и у кого это есть' },
}, required: ['status', 'stack', 'stack_basis', 'test_cmd', 'report_cmd', 'build_cmd', 'prepare_cmd', 'prepare-status', 'prepare_log', 'missing'] }
const PREP_STEPS = `1. Стек - идентификатор по реестру: вызови Skill dex-skill-stack-registry:stack-registry и сопоставь с манифестом проекта; вне реестра - "other". Манифест, из которого вывел, назови в stack_basis - догадка по именам файлов не принимается. По тому же манифесту назови команды сборки и тестов.
2. report_cmd - test_cmd, дополненная встроенным флагом раннера, который пишет отчёт JUnit XML либо TRX в каталог "$DEX_AUTO_JUNIT_DIR" (переменную задаёт верификатор), например: dotnet test - --logger trx --results-directory "$DEX_AUTO_JUNIT_DIR"; pytest - --junitxml="$DEX_AUTO_JUNIT_DIR/r.xml"; node --test - --test-reporter=junit --test-reporter-destination="$DEX_AUTO_JUNIT_DIR/r.xml"; vitest - --reporter=junit --outputFile="$DEX_AUTO_JUNIT_DIR/r.xml". Флаг не известен наверняка, требует пакета либо test_cmd - обёртка (npm test, make) без проброса аргументов - пусто.
3. Подготовка: проекту до сборки нужны зависимости, которых сборка сама не ставит, либо шаг подготовки, названный проектом, - назови команду и выполни её в рабочем каталоге; не нужны - prepare_cmd пуст, prepare-status: not-needed. Строки git status --porcelain, которых до команды не было, верни: ?? - удали путь, прочие - git checkout -- путь. prepare-status: done - команда вернула 0, иначе failed.
Код не правь, сборку и тесты не гоняй.`
const steps = (t) => (Array.isArray(t) ? t : String(t || '').split('\n')).map(s => typeof s === 'string' ? fromLedger(s.replace(/^- /, '')) : s).filter(e => e && typeof e === 'object')
// Первый замер green либо red из trail старше свежего: на возобновлении дерево несёт правки трека, а их опознание узлом не гарантия.
function baselineOf(fresh, trail) {
  const e = steps(trail).find(x => x.step === '1-tree' && ['green', 'red'].includes(x.baseline))
  if (e) return { status: e.baseline, log: e.baseline_log || '', failing: Array.isArray(e.baseline_failing) ? e.baseline_failing : [], fresh: false }
  if (fresh && ['green', 'red'].includes(fresh.status)) return { ...fresh, fresh: true }
  return null
}
// Замер покупается только там, где он что-то меряет: база прошлого прогона в trail не перебивается свежей (T5a).
const baseSkip = (p, trail) => !p || p.status === 'blocked' ? 'подготовка не отработала' : p['prepare-status'] === 'failed' ? 'подготовка дерева не удалась'
  : p['prepare-status'] === 'skipped' ? 'каталог подготовлен прошлым прогоном' : !p.build_cmd && !p.test_cmd ? 'нет ни сборки, ни тестов'
  : baselineOf(null, trail) ? 'база прошлого прогона в trail' : ''
const baseFrom = (v) => noRun(v) ? { status: 'n/a', log: `верификация базы не прогнала: ${(v && v.missing) || 'выхода нет'}`, failing: [] }
  : v.dirty || v.ahead > 0 ? { status: 'n/a', log: 'в дереве правки трека', failing: [] }
  : v.build_ok && v.exit_code === 0 && !v.failing.length ? { status: 'green', log: `прошло тестов: ${v.pass_count}`, failing: [] }
  : { status: 'red', log: redNote(v, []), failing: v.failing }
const baselineNote = (b) => !b ? '' : b.status === 'red'
  ? ` До правок трека сборка и тесты уже падали (${b.failing.join('; ') || b.log || 'что упало, не названо'}): эти падения унаследованы, прочие внесены правками трека.`
  : ' До правок трека сборка и тесты были зелёными: любое падение внесено правками трека.'
// Узел подготовки на возобновлении повторял установленное (T1a); опора - последний настоящий замер, пропуск ею не служит.
function priorPrep(tc, trail) {
  const last = steps(trail).filter(e => e.step === '1-tree' && e.status !== 'skipped').pop()
  const fits = !!tc && typeof tc.stack === 'string' && !!tc.stack && !!(tc.build_cmd || tc.test_cmd)
    && !!last && ['complete', 'partial'].includes(last.status) && last.prepare !== 'failed'
  return fits ? { status: 'complete', stack: tc.stack, build_cmd: tc.build_cmd || '', test_cmd: tc.test_cmd || '', report_cmd: tc.report_cmd || '', prepare_cmd: tc.prepare_cmd || '', 'prepare-status': 'skipped' } : null
}
const TREE_SKIPPED = { step: '1-tree', doer: 'ledger (техконтекст прошлого прогона)', status: 'skipped' }
// <<< shared: prep
// >>> shared: own-commits
const OWN_COMMITS = 'git rev-list HEAD --not --exclude="$(git branch --show-current)" --branches'
// <<< shared: own-commits
// >>> shared: self-review
// Исход по тесту - enum: показанный красным трек передаёт следующей попытке как факт, а не ищет слово в прозе.
const RED_STATUS = ['shown', 'unverifiable']
const RED_RUN = (scope) => ({ type: 'array', items: { type: 'object', properties: { test: { type: 'string', description: 'имя или путь теста' }, status: { type: 'string', enum: RED_STATUS }, evidence: { type: 'string', description: 'shown - нарушение, на котором тест был красным (код до правки либо порча целевой ветки), и сверенная причина падения; unverifiable - чем пробовал' } }, required: ['test', 'status', 'evidence'] }, description: scope })
const redLines = (rr) => (rr || []).length ? rr.map(r => `${r.test} ${r.status}: ${r.evidence}`).join('; ') : 'пусто'
// Ключи - имена полей выдачи из файлов узлов буквально: трансляция - место тихого расхождения схемы и нормы узла.
const FIX = { type: 'object', properties: {
  status: STATUS,
  plan: { type: 'array', items: { type: 'object', properties: { where: { type: 'string' }, change: { type: 'string' }, trace: { type: 'string' } }, required: ['where', 'change', 'trace'] }, description: 'план реализации в итоговой редакции: where - файл или символ, change - суть изменения, у отступления - с причиной, trace - требование, правило проекта с якорем, стандарт или практика' },
  'diff-scope': { type: 'array', items: { type: 'string' }, description: 'пути изменённых файлов и ветка, не тела' },
  commit: { type: 'string', description: 'sha локального коммита либо пусто' },
  commands: { type: 'object', properties: { build_cmd: { type: 'string' }, test_cmd: { type: 'string' }, report_cmd: { type: 'string' } }, required: ['build_cmd', 'test_cmd', 'report_cmd'] },
  'run-status': { type: 'string', description: 'свой прогон сборки и тестов: команда и исход; проверка неприменима - n/a с причиной, запуск невозможен - unverifiable с тем, что пробовал, и тогда status partial; зелёность трек судит VERIFY-узлом, не этим полем' },
  'red-run': RED_RUN('запись на каждый новый и изменённый тест и на существующий, чью целевую ветку тронула правка (прежняя запись истекает с прежним поведением); подпадающих тестов нет - пустой перечень'),
  // Признак замкнутости - enum: свободную строку модель отдаёт синонимами, а пустое значение неотличимо от невыясненного.
  'uncovered-status': { type: 'string', enum: ['none', 'some', 'unknown'], description: 'осталось ли непокрытое тестами: none - не осталось, some - перечень в uncovered, unknown - покрытие не выяснялось; догадка сюда не пишется' },
  uncovered: { type: 'array', items: { type: 'string' }, description: 'при some - непокрытое перечнем (ветка, случай, граница); иначе пустой' },
  'dependents-status': { type: 'string', enum: ['none', 'some', 'unknown'], description: 'видно ли правку за пределами diff-scope: вызывающий код, контракт на проводе, схема данных, публичный API. none - не видно, some - видно (перечень в dependents), unknown - не разобрался; догадка сюда не пишется' },
  dependents: { type: 'array', items: { type: 'string' }, description: 'при some - потребители перечнем file:line; иначе пустой' },
  'fact-check': FACT_CHECK('сигнатура или поведение стороннего API в правке'),
  decisions: { type: 'array', items: { type: 'string' }, description: 'первой строкой - вызванные скиллы либо почему ни один не подошёл; далее каждая закрытая узлом развилка: что выбрано, из чего, почему' },
  // Пометку пробы судит ревью: кодеру находку с ней не подают, и его запись её не трогает.
  prior: { type: 'array', items: { type: 'object', properties: { id: PRIOR.properties.id, anchor: PRIOR.properties.anchor, severity: SEV, axis: PRIOR.properties.axis, text: PRIOR.properties.text, status: PRIOR.properties.status, evidence: PRIOR.properties.evidence }, required: ['id', 'anchor', 'severity', 'axis', 'text', 'status', 'evidence'] }, description: 'по каждой находке задания - запись с её id: closed - закрыта правкой, disputed - закрывать не следует; находок в задании нет - пусто' },
  missing: { type: 'string' },
}, required: ['status', 'plan', 'diff-scope', 'commit', 'commands', 'run-status', 'red-run', 'uncovered-status', 'uncovered', 'dependents-status', 'dependents', 'fact-check', 'decisions', 'prior', 'missing'] }
const REVIEW = { type: 'object', properties: {
  status: STATUS,
  findings: { type: 'array', items: { type: 'object', properties: { ref: FINDING.properties.ref, anchor: FINDING.properties.anchor, severity: SEV, axis: FINDING.properties.axis, text: FINDING.properties.text,
    closure: FINDING.properties.closure, evidence: FINDING.properties.evidence, premise: FINDING.properties.premise },
  required: ['ref', 'anchor', 'severity', 'axis', 'text', 'closure', 'evidence', 'premise'] }, description: 'только находки, которых нет в перечне прежних' },
  axes: AXES,
  roots: ROOTS,
  'run-status': { type: 'string', description: 'прогон свой, не пересказ входа' },
  'red-run': { type: 'string', description: 'вердикт по записям red-run кодера во входе: по каждому тесту дельты запись действует / красным не показан (unverifiable кодера) / отсутствует / истекла; записей не было - unverifiable + что искал; тестов в дельте нет - n/a' },
  'fact-check': FACT_CHECK('техутверждения находок о стороннем API'),
  'conventions-read': CONVENTIONS_READ,
  intent: { type: 'string', description: 'сверка с источником намерения входа: соответствует / расхождения «корректно, но не то»; источника нет - n/a' },
  'intent-status': { type: 'string', enum: ['match', 'mismatch', 'n/a'], description: 'mismatch - сделано не то, чего требует источник намерения входа: подробности в intent, каждое расхождение - ещё и находка P0/P1: новая - в findings, из перечня - открытой записью prior' },
  prior: { type: 'array', items: PRIOR, description: 'по каждой находке перечня прежних - запись с её id, статус с уликой; перечня нет - пусто' },
  'review-verdict': { ...VERDICT, description: 'сигнал оператору, порог допуска трека его не читает' },
  missing: { type: 'string', description: 'при blocked - чего не хватило для ревью; иначе пусто' },
}, required: ['status', 'findings', 'axes', 'roots', 'run-status', 'red-run', 'fact-check', 'conventions-read', 'intent', 'intent-status', 'prior', 'review-verdict', 'missing'] }
const UNSETTLED = 'статус саморевью не сверен'
const LISTED = 'Перечень находок: по каждой - запись в prior с её id, статус с уликой; находка перечня идёт только в prior, в findings - то, чего в перечне нет:'
// fix перезаписывается каждой попыткой: решения и оспаривание прежней находки без переноса в decisions до выхода не доезжают.
const said = (f) => [...(f.decisions || []), ...(f.prior || []).filter(p => p.status === 'disputed').map(p => `${p.id || p.anchor}: кодер оспорил закрытие - ${p.evidence}`)]
// Записи red-run и uncovered кодера - вход саморевьюера: он судит red-run по записям входа, а uncovered адресован следующему узлу.
const coderInput = (f) => f ? `\nВход от кодера - план:\n${(f.plan || []).map(p => `- ${p.where}: ${p.change}`).join('\n') || '- не подан'}\nred-run: ${redLines(f['red-run'])}\nuncovered: ${f['uncovered-status']}${(f.uncovered || []).length ? ' - ' + f.uncovered.join('; ') : ''}\ndependents: ${f['dependents-status']}${(f.dependents || []).length ? ' - ' + f.dependents.join('; ') : ''}` : ''
// partial кодера и опровергнутая им сверка - исход автора: зелёная верификация и чистое ревью их не закрывают.
const authorGap = (f, offeredOnly = false) => !f ? '' : f.status === 'partial' && !offeredOnly ? `кодер вернул partial: ${f.missing || f['run-status'] || 'нехватка не названа'}` : (f['fact-check'] || []).some(c => c.status === 'contradicted') ? `fact-check кодера: contradicted - ${f['fact-check'].filter(c => c.status === 'contradicted').map(c => `${c.claim} (${c.source})`).join('; ')}` : ''
// partial правки одних offered итога не держит: её находки порога не держат; partial реализации держит (domain.md §4).
const coderGap = (fix, fix2, offeredOnly) => offeredOnly ? authorGap(fix) || authorGap(fix2, true) : authorGap(fix2 || fix)
// Порог допуска: зелёная верификация и ноль открытых P0/P1 реестра прогона; review-verdict - сигнал оператору, порог его не читает.
const stuckLine = (p) => `${p.id} ${p.status} - ${awaitsProbe(p) ? `нужна проба оператора: ${p.premise}` : p.evidence}`
const admit = (green, rev, stuck, gaps) => !green ? 'верификация после правки по саморевью не прошла'
  : !rev ? 'саморевьюер не вернул выход'
  : rev.status === 'blocked' ? `саморевью не выполнено: ${lack(rev, 'саморевьюер')}`
  : stuck.some(isBlocking) ? `открытые P0/P1: ${stuck.filter(isBlocking).map(stuckLine).join('; ')}` : gaps
// Не правится в прогоне и порог не держит, но вопрос оператору не теряется: «продолжить» подаёт такую находку кодеру из ledger.
const askLines = (r) => r.asking().map(f => `${f.id} [${f.severity}] ${f.anchor}: ${awaitsProbe(f) ? `нужна проба оператора - ${f.premise}` : `${f.introduced ? 'внесена правкой, ' : ''}порога не держит, решение за оператором - ${f.text}`}`)
// Закрытая в прогоне находка в перечне - чтобы ревью сверило, не вернула ли её правка.
const listedLine = (p) => `${priorLine(p)}${p.status === 'closed' ? ' (закрыта в этом прогоне: сверь, что правка её не вернула)' : ''}`
// Ревизия - поле head_sha: head - текст git log, у модели-верификатора его первое слово не обязано быть sha.
const shaOf = (v) => isSha(String(v && v.head_sha || '').trim()) ? String(v.head_sha).trim() : ''
const isSha = (x) => /^[0-9a-f]{7,40}$/i.test(String(x || ''))
// Ветку до head ревью либо сверки complete уже прочли: повторное чтение всего диффа ветки - главная статья прогона дочистки.
// Диагноз либо разведка, выведенные узлом, а не взятые из ledger, - новое намерение: ревью до них судили прежнее.
const INTENT_STEPS = ['1-repro', '1-req']
// Шаг 3-repeat пишут прогоны до 9.2.0 - их trail ещё читается из ledger.
const priorBase = (trail) => {
  const all = steps(trail), from = all.reduce((k, e, i) => INTENT_STEPS.includes(e.step) && !/^ledger/.test(e.doer || '') ? i : k, -1)
  return (all.slice(from + 1).filter(e => [3, '3-check', '3-repeat'].includes(e.step) && e.status === 'complete' && e.settled !== false && isSha(e.head)).pop() || {}).head || ''
}
const scope = (base) => base ? `дельта от ${base} - коммиты после него плюс рабочее дерево. Новые находки ищи в дельте, вне её - только сломанное правкой дельты; статус прежних находок перечня суди на текущем коде. ${base} не предок HEAD - ревью по всем коммитам цели.` : 'коммиты этой цели плюс рабочее дерево.'
const HUNKS = { type: 'object', properties: {
  status: STATUS,
  hunks: { type: 'array', items: { type: 'string' }, description: 'путь от корня репозитория без a/ и b/, место file:from-to по +start,count заголовка @@ (from = start, to = start+count-1); только удалённые строки (count 0) - file:start; удалённый файл - file; переименованный - ещё и старый путь, как удалённый' },
  conventions: CONVENTIONS.conventions, 'conventions-searched': CONVENTIONS['conventions-searched'],
  missing: { type: 'string' },
}, required: ['status', 'hunks', 'conventions', 'conventions-searched', 'missing'] }
// Места правки считает скрипт: арифметику заголовков @@ модель путает на единицу; узлу остаётся отсев файлов тестов.
// Сомнение, относится ли документ к правке, - не неполнота снимка: partial снимка - строка degraded.
const HUNKS_STATUS = 'Документ, о котором неясно, относится ли он к правке, включи в conventions. status - complete, когда места сняты; partial - только когда места сняты не целиком.'
const hunksAsk = (base) => A.scripts ? `ТОЛЬКО перечень мест правки и правил проекта, код не менять. Выполни python3 '${A.scripts}/verify.py' --hunks${base ? ` ${base}` : ''}: hunks - поле hunks его вывода как есть, без файлов тестов; поле error в выводе либо вывод не JSON - status partial, error либо последние строки вывода в missing. ${conventionsAsk} ${HUNKS_STATUS}`
  : `ТОЛЬКО перечень мест правки и правил проекта, код не менять. ${base ? `git diff -U0 ${base}; ${base} не предок HEAD (git merge-base --is-ancestor) - как без базы. ` : ''}Без базы - git diff -U0 "$(${OWN_COMMITS} | tail -1)^", своих коммитов нет - git diff -U0 HEAD. Место - путь от корня репозитория без a/ и b/, место file:from-to по +start,count заголовка @@ (from = start, to = start+count-1); только удалённые строки (count 0) - file:start; удалённый файл - file; переименованный - ещё и старый путь, как удалённый. Файлы тестов не включай. ${conventionsAsk} ${HUNKS_STATUS}`
const hunksOf = (tag, base) => node('снимок правки', `${HEAD}Шаг 3 (${tag}): ${hunksAsk(base)}`, { label: `hunks:${tag}`, phase: 'Review', model: 'haiku', effort: 'low', schema: HUNKS })
const spotsOf = (h) => h && h.status !== 'blocked' ? h.hunks : []
const doubted = (rev, listed) => listed.map(p => { const c = (rev.prior || []).find(q => q.id === p.id); return `${priorLine(p)} - саморевьюер: ${c ? `${c.status} - ${c.evidence}` : 'статус не назван'}` }).join('\n')
const falsifyOf = (tag, rev, listed, base, h) => own('скептик', `${HEAD}Шаг 3 (${tag}): фальсификация находок, исходов осей, решений и статусов прежних из саморевью; вердикт по покрытию. Объём - ${scope(base)} Код не меняй.${conventionsText(h)}\nНаходки:\n${rev.findings.map(findingLine).join('\n') || '- находок нет: только вердикт по покрытию'}${listed.length ? `\nПрежние находки - статус саморевьюера:\n${doubted(rev, listed)}` : ''}\nОси саморевьюера:\n${axesText(rev.axes)}\nРешения саморевьюера:\n${rootsText(rev.roots)}`,
  { label: `falsify:${tag}`, phase: 'Review', schema: FALSIFY }, NODE.skeptic)
const judged = (fal) => !!fal && fal.status !== 'blocked' && !fal.skipped
// Сверка стоит как само ревью, а без P0/P1 исход итога от неё не зависит (P115).
const needsSkeptic = (rev, listed) => [...rev.findings, ...listed].some(isBlocking)
const SKIPPED = { skipped: true, status: 'skipped', confirmed: [], dropped: [], prior: [] }
// В реестр входит выход скептика; без него - claims ревьюера, и разрыв не выпускает complete.
const verdictOf = (rev, fal) => judged(fal) ? { status: fal.status, findings: fal.confirmed, prior: fal.prior } : rev
const spotGap = (rev, h) => !rev || rev.status === 'blocked' ? '' : !h || h.status === 'blocked' ? `места правки не сняты: ${lack(h, 'снимок правки')}`
  : [h.status === 'partial' ? `места правки сняты не целиком: ${h.missing || 'нехватка не названа'}` : '', hunkGap(h.hunks, rev.roots) ? `саморевью: ${hunkGap(h.hunks, rev.roots)}` : '', conventionsGap(h, rev) ? `саморевью: ${conventionsGap(h, rev)}` : ''].filter(Boolean).join('; ')
const falsifyGap = (rev, fal) => !rev || rev.status === 'blocked' || (fal && fal.skipped) ? '' : !judged(fal) ? `фальсификация саморевью не выполнена: ${lack(fal, 'скептик')}`
  : [fal.status === 'partial' ? `фальсификация саморевью не завершена: ${fal.missing || 'нехватка не названа'}` : '', silentGap(rev.findings, fal) ? `саморевью: ${silentGap(rev.findings, fal)}` : ''].filter(Boolean).join('; ')
// Разрыв итога - вердикт не вынесен; разрыв учёта (traceGap) - строка degraded, итог не держит (domain.md §4). chk undefined - сверки не было.
const intentGap = (r, fal) => r['intent-status'] === 'mismatch' && ![...(verdictOf(r, fal).findings || []), ...(verdictOf(r, fal).prior || [])].some(f => isBlocking(f) && stillOpen(f)) ? `саморевью: реализовано не то, а находки P0/P1 нет: ${r.intent}` : ''
const fixCheckGap = (c) => c === undefined ? '' : !c || c.status === 'blocked' ? `сверка правки не выполнена: ${lack(c, 'саморевьюер')}` : c.status === 'partial' ? `сверка правки не завершена: ${c.missing || 'нехватка не названа'}` : ''
const reviewGap = (r, fal, chk) => !r || r.status === 'blocked' ? '' : [r.status === 'partial' ? `саморевью не завершено: ${r.missing || 'нехватка не названа'}` : '', intentGap(r, fal), falsifyGap(r, fal), fixCheckGap(chk)].filter(Boolean).join('; ')
// Место находки, дописанное скептиком (places), есть только в реестре: без него решение на этом месте числится без находки.
const traceGap = (r, h, fal, reg = []) => {
  if (!r || r.status === 'blocked') return ''
  const found = judged(fal) ? [...(fal.confirmed || []), ...(fal.prior || [])] : []
  const parts = [axesGap(r.axes, r.findings), rootsGap(r.roots, [...(r.findings || []), ...(r.prior || []), ...reg]), ...(judged(fal) ? [axesCheckGap(r.axes, fal['axes-check'], found), rootsCheckGap(r.roots, fal['roots-check'], found), rootsMissedGap(fal['roots-missed'], r.roots)] : [])]
  return [spotGap(r, h), ...parts.filter(Boolean).map(g => `саморевью: ${g}`)].filter(Boolean).join('; ')
}
const CHECK = { type: 'object', properties: {
  status: STATUS,
  prior: { type: 'array', items: PRIOR, description: 'по каждой находке перечня - запись с её id, статус с уликой из кода ревизии' },
  findings: { type: 'array', items: { type: 'object', properties: { ref: FINDING.properties.ref, anchor: FINDING.properties.anchor, severity: SEV, axis: FINDING.properties.axis, text: FINDING.properties.text, closure: FINDING.properties.closure, evidence: FINDING.properties.evidence, premise: FINDING.properties.premise },
    required: ['ref', 'anchor', 'severity', 'axis', 'text', 'closure', 'evidence', 'premise'] }, description: 'только дефекты, внесённые дельтой правки: место пересекает дельту, находки нет в перечне' },
  missing: { type: 'string', description: 'при blocked либо partial - чего не хватило для сверки; иначе пусто' },
}, required: ['status', 'prior', 'findings', 'missing'] }
// Сверка - не ревью (domain.md §1): решения, оси и правила проекта судило ревью, полный прогон дала верификация.
const checkOf = (k, base, listed, f, note) => own('саморевьюер', `${HEAD}Шаг 3 (сверка правки ${k}): не ревью. Объём - ${base ? `дельта от ${base}: коммиты после него плюс рабочее дерево; ${base} не предок HEAD - коммиты правок по находкам этого прогона` : 'коммиты правок по находкам этого прогона плюс рабочее дерево'}. По каждой находке перечня - запись в prior с её id, статус на текущем коде с уликой; правка закрыла путь, а не механизм, - partial либо open, незакрытые пути в evidence. В findings - только дефект, внесённый дельтой: его место пересекает дельту. Решения правки, оси и правила проекта не суди. Сборку и тесты целиком прогнала верификация, она зелёная: запускай только то, что нужно улике.${coderInput(f)}${note}\nПеречень:\n${listed.map(listedLine).join('\n')}\nКод не меняй.`,
  { label: 'check:правки', phase: 'Review', schema: CHECK }, NODE.reviewer)
// <<< shared: self-review
// >>> shared: review-loop
const KEEP = 'Инварианты правки - источник намерения ниже и закрытые в этом прогоне находки: правка их не нарушает и не сужает поведение допущением о входе или среде, которого в источнике нет; такое допущение находку не закрывает.'
const keepText = (closed) => `\n${KEEP}${closed.length ? `\nЗакрытые в этом прогоне:\n${closed.map(f => `- ${f.id} ${f.anchor}: ${f.closure || f.text}`).join('\n')}` : ''}`
const deltaOf = (v) => v && Array.isArray(v.delta) ? v.delta : null
// Цикл - docs/domain.md §4; t несёт различия треков: review, coder, intent, run (команды прогона), verify, red (итог незелёной верификации), afterCoder (выход трека либо null), afterVerify, checkNote (необязательный: строка сверке по верификации правки), moved (необязательный: сменила ли правка тест диагноста bugfix; true - сверка не пропускается).
const OFFERED = 'На твоё решение - порога не держат: правь, только если правка не выходит за места, которые уже меняет правка цели либо называет находка, и не меняет наблюдаемого поведения вне находки; иначе запись prior disputed с основанием.'
async function reviewLoop(t) {
  const { fix, ver, firstBase } = t
  let fix2 = null, ver2 = null, deltaFrom = null, red = '', offeredOnly = false, chk
  const spots = await hunksOf('первое', firstBase)
  const rev = await t.review('первое', fix, ver, LEDGER, firstBase, spots); loops.review = 1
  const first = { step: 3, doer: NODE.reviewer.agentType, status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1, verdict: rev ? rev['review-verdict'] : null, head: shaOf(ver), base: firstBase }
  trail.push(first)
  const dropped = []
  let fal = null
  if (rev && rev.status !== 'blocked') {
    if (!needsSkeptic(rev, LEDGER)) { trail.push({ step: '3-falsify', doer: 'не куплен: P0/P1 нет', status: 'skipped' }); fal = SKIPPED }
    else {
      fal = await falsifyOf('первое', rev, LEDGER, firstBase, spots)
      trail.push({ step: '3-falsify', doer: NODE.skeptic.agentType, status: fal ? fal.status : 'null', confirmed: fal ? fal.confirmed.length : -1, dropped: fal ? fal.dropped.length : -1 })
      if (judged(fal)) dropped.push(...fal.dropped)
    }
    // Ревью с разрывом итога базой следующего прогона не служит: его вердикт не вынесен (priorBase).
    first.settled = !falsifyGap(rev, fal) && !intentGap(rev, fal)
  }
  const reg = registry(UNSETTLED)
  LEDGER.forEach(reg.doubt)
  reg.apply(verdictOf(rev, fal), judged(fal) ? 'скептик' : 'саморевьюер')
  const offeredHere = new Set()
  // Вопрос оператору (domain.md §2) едет и в выходе из цикла: иначе P2 видна только записью prior.
  const state = (exit) => ({ exit: exit && { ...exit, decisions: [...(exit.decisions || []), ...askLines(reg)] }, rev, fal, chk, reg, spots, fix2, ver2, dropped, offeredOnly })
  while (rev && rev.status !== 'blocked' && loops.review_fix < REVIEW_FIX_CEILING) {
    // Не держащая порог подаётся кодеру один раз: оспоренная им осталась бы открытой и гоняла круги до потолка.
    const may = reg.offers().filter(f => !offeredHere.has(f.id))
    if (!reg.fixes().length && !may.length && !red) break
    const k = ++loops.review_fix, must = reg.fixes().length > 0 || !!red
    may.forEach(f => offeredHere.add(f.id))
    if (deltaFrom === null) deltaFrom = shaOf(ver2 || ver)
    fix2 = await t.coder(`${HEAD}Шаг 2 (правка по находкам ${k} из ${REVIEW_FIX_CEILING}):${red ? ` верификация прошлой правки не прошла: ${red}.` : ''}${reg.fixes().length ? ` закрой находки:\n${reg.fixes().map(findingLine).join('\n')}` : ''}${may.length ? `\n${OFFERED}\n${may.map(findingLine).join('\n')}` : ''}${keepText(reg.closed())}\n${t.intent()}\n${t.run()}\nПосле правки коммит локально, push не делать. По каждой находке - запись в prior с её id: closed с уликой либо disputed с основанием, почему закрывать не следует.`)
    if (fix2) decisions.push(...said(fix2))
    const exit = fix2 && t.afterCoder(fix2, k, { review: rev, prior: reg.all() })
    if (exit) return state(exit)
    const prevVer = ver2 || ver
    ver2 = !fix2 || fix2.status === 'blocked' ? null : await t.verify('после саморевью', deltaFrom)
    t.afterVerify(ver2)
    offeredOnly = !must
    trail.push({ step: '2-after-review', attempt: k, doer: NODE.coder.agentType, status: fix2 ? fix2.status : 'null', passed: passed(ver2), 'red-run': fix2 ? fix2['red-run'] : null })
    const openNow = { review: rev, falsify: fal, prior: reg.all(), dropped }
    if (!fix2 || fix2.status === 'blocked') return state(nodeBail('Review: правка по находкам', lack(fix2, 'узел-кодер'), openNow))
    if (noRun(ver2)) return state(nodeBail('Review: верификация после правки', lack(ver2, 'верификатор'), openNow))
    // Правка одних offered сверку не покупает: их исход итога не держит (domain.md §4); сменивший тест диагноста круг пропуска не получает (t.moved).
    if (!must && passed(ver2) && !(t.moved && t.moved(prevVer, ver2))) {
      const shut = (fix2.prior || []).filter(p => p.status === 'closed' && may.some(f => f.id === p.id))
      shut.forEach(p => reg.seat(p, 'closed', `закрыто кодером без сверки: ${p.evidence}`))
      decisions.push(...shut.map(p => `${p.id}: закрыто кодером без сверки - ${p.evidence}`))
      trail.push({ step: '3-check', attempt: k, doer: 'не куплена: правка одних offered, верификация зелёная', status: 'skipped', closed: shut.length })
      break
    }
    if (!passed(ver2)) {
      red = t.red(ver2)
      trail.push({ step: '3-check', attempt: k, doer: 'не куплена: верификация правки не зелёная', status: 'skipped' })
      continue
    }
    red = ''
    if (!deltaOf(ver2)) degraded.push(`дельта правки по находкам ${k} не получена - новые находки сверки после неё считаются внесёнными правкой`)
    const listed = reg.listing()
    chk = await checkOf(k, deltaFrom, listed, fix2, t.checkNote ? t.checkNote(ver2) : ''); loops.check = k
    trail.push({ step: '3-check', attempt: k, doer: NODE.reviewer.agentType, status: chk ? chk.status : 'null', findings: chk ? chk.findings.length : -1, head: shaOf(ver2), base: deltaFrom, settled: first.settled !== false })
    // Сверка без выхода либо blocked статусов не выносит: реестр остаётся, каким его оставило ревью.
    if (!chk || chk.status === 'blocked') break
    listed.forEach(reg.doubt)
    reg.apply(chk, 'сверка правки', listed, introducedAt(deltaOf(ver2)))
  }
  return state(null)
}
// <<< shared: review-loop
const REQ = { type: 'object', properties: {
  status: STATUS,
  requirements: { type: 'array', items: { type: 'string' }, description: 'единицы R/I с номером R1..Rn и источником файл:строка либо пометкой "допущение"' },
  files: { type: 'array', items: { type: 'string' } },
  corpus: { type: 'string', description: 'найденный корпус документации проекта либо "корпуса нет"' },
  // Противоречие источников уезжало вниз строкой внутри requirements: трек читает у разведки
  // только status, и работа шла по стороне, выбранной узлом (зонд P23). Поле - enum, чтобы «нет
  // противоречий» отличалось от невыясненного, а не угадывалось по пустому перечню.
  'conflict-status': { type: 'string', enum: ['none', 'some'], description: 'противоречие между источниками о том, что считать готовым: none - нет, some - перечень в conflicts' },
  conflicts: { type: 'array', items: { type: 'string' }, description: 'при some - каждое противоречие строкой: якорь обеих сторон и что требует каждая; иначе пустой' },
  missing: { type: 'string', description: 'при blocked - чего не хватает и у кого это есть' },
}, required: ['status', 'requirements', 'files', 'corpus', 'conflict-status', 'conflicts', 'missing'] }
const loops = { fix: 0, review_fix: 0, review: 0, check: 0 }
const trail = [], degraded = [...goalLack]
const unfedArgs = unfed(A, ['task', 'cwd', 'goal'])
if (unfedArgs.length) return outcome('blocked', 'Context', `трек вызван без входа: нет ${unfedArgs.join(', ')}`)
const LEDGER = resuming ? ledgerList(A.open_findings, 'находки прошлого прогона кодеру не поданы') : []
const ASK = LEDGER.filter(f => !awaitsProbe(f))
const OPEN = ASK.length ? `\nНезакрытые находки прошлого прогона (из ledger): по каждой - запись в prior с тем же id: closed с уликой либо disputed с основанием, почему закрывать не следует:\n${ASK.map(findingLine).join('\n')}\n` : ''
let ctx = null, fix = null, fix2 = null, ver = null, ver2 = null, cmds0 = null
// Решения копятся по попыткам: fix перезаписывается каждым кругом, и без накопления в ledger уезжает только последний.
const decisions = []
const dec = () => decisions.slice()
const bail = (where, missing, extra) => outcome('blocked', where, missing, { decisions: dec(), ctx, fix, ...extra })
// Сбой узла (нет выхода, blocked узла): finish.sh не пишет его в «Нехватку трека», иначе возобновление запустит кодера на зелёном дереве (ledger.md R11).
const nodeBail = (where, missing, extra) => bail(where, missing, { ...extra, node_failure: true })
// Падения базы до правок: правке не вменяются (T10).
let known = []
const passed = (v) => isGreen(v, ctx && ctx.test_cmd, known)

// Вход собирает /auto; workflow, вызванный по имени, приходит без него - узлы без цели и каталога не запускаются (T0).
const noInput = ['task', 'goal', 'cwd'].filter(k => !String(A[k] || '').trim())
if (noInput.length) return outcome('blocked', 'Context', `трек вызван без входа: нет ${noInput.join(', ')}`)
phase('Context')
const BASE_HEAD = `mode: ${A.mode || 'autonomous'}\nзадача (${A.task}): замерить сборку и тесты до правок трека - и только это.\n${TREE}`
const verifyNode = async (head, tag, t, kn, ph, extra) => {
  const v = await node('верификатор', `${head}Верификация (${tag}): ТОЛЬКО прогон и отчёт, код не менять. ${A.scripts ? verifyRun(A.scripts, verifySpec(t, kn, extra)) : `Выполни ${t.build_cmd ? `сборку: ${t.build_cmd}; ` : ''}${t.test_cmd ? `тесты: ${t.test_cmd}` : 'тестов нет - build_ok по сборке, счётчики 0'}; затем ${VERIFY_CMDS}. Числа - из вывода раннера как есть.`}`,
    { label: `verify:${tag}`, phase: ph, model: 'haiku', effort: 'low', schema: VERIFY })
  if (v && Array.isArray(v.flaky) && v.flaky.length) decisions.push(`верификация (${tag}): нестабильные тесты - упали и прошли в повторе: ${v.flaky.join('; ')}`)
  return v
}
// Разведка выводится из неизменного - цели, манифеста и кода, - поэтому при возобновлении берётся
// из ledger, а не покупается заново: повтор ещё и перевыводит номера R, на которые ссылаются
// находки прошлого прогона.
// Барьер здесь по существу: шаг 2 нуждается в обеих половинах, а порознь они выводятся из разного -
// требования из цели и кода, команды из манифеста.
// Поле возобновления кладёт главный поток из ledger, но подать он может что угодно: непроверенная
// форма роняла трек на первом же обращении к разведке (зонд P25). Непригодное поле трек не
// останавливает - разведка покупается узлом, а подмена названа оператору.
const ctxIn = fromLedger(A.ctx)
// Пустой «Контекст» прошлую запись ledger не перекрывает: сброс разведки (T4) пишется формой со статусом reset.
const CTX_RESET = { status: 'reset', requirements: [], files: [] }
const ctxWasReset = !!ctxIn && ctxIn.status === CTX_RESET.status
const ctxFormed = !!ctxIn && Array.isArray(ctxIn.requirements) && ctxIn.requirements.length > 0 && Array.isArray(ctxIn.files) && (ctxIn.conflicts === undefined || Array.isArray(ctxIn.conflicts))
// Неполная разведка прошлого прогона - не продукт: недостающее оператор даёт в источник, и «продолжить» выводит её заново, иначе разрыв повторялся бы каждым прогоном.
const ctxResumed = ctxFormed && ctxIn.status === 'complete' ? ctxIn : null
if (A.ctx && !ctxFormed && !ctxWasReset) degraded.push('поле ctx подано не в форме разведки (нужны перечни requirements и files, conflicts - перечнем) - разведка выведена узлом заново')
else if (ctxWasReset || (ctxFormed && !ctxResumed)) decisions.push(`разведка прошлого прогона ${ctxIn.status || 'без статуса'} - выведена узлом заново`)
const priorTree = priorPrep(ctxResumed, resuming ? A.trail : null)
if (!A.scripts) degraded.push(NO_SCRIPTS)
// База - за подготовкой в той же ветке: разведка дерево не трогает, а замер до правок нужен только подготовленному дереву (T5b).
const [tree, req] = await parallel([
  async () => {
    const p = priorTree || await node('подготовка дерева', `${PREP_HEAD}Шаг 1 (техконтекст и подготовка):\n${PREP_STEPS}`,
      { label: 'ctx:tree', phase: 'Context', model: 'haiku', schema: PREP })
    const skip = baseSkip(p, resuming ? A.trail : null)
    return { p, base: skip ? { status: 'n/a', log: skip, failing: [] } : baseFrom(await verifyNode(BASE_HEAD, 'база', p, [], 'Context')) }
  },
  () => ctxResumed ? Promise.resolve(ctxResumed) : node('аналитик контекста', `${HEAD}${DONE}Шаг 1 (требования): R/I. Источник: ${A.source || 'формулировка цели выше'}; прочитай его, исходники и тесты. Поищи корпус документации проекта (docs/, README, ADR, CLAUDE.md) - нет, так и скажи. Верни R/I: каждая единица пронумерована R1..Rn, с источником файл:строка либо пометкой "допущение". ${A.source ? `Требования и критерии приёмки источника против критерия «готово» цели суди вызовом Skill dex-skill-requirement-quality:requirement-quality, раздел «Противоречие»: поднятое им расхождение - строкой conflicts с якорями обеих сторон и тем, что требует каждая, conflict-status: some. Допущение, при котором прямое требование источника не исполняется, - не единица R/I, а строка conflicts; допущение там, где источник молчит, - единица R/I. ${ownerSide}` : `Источника требований нет - критерий «готово» сверять не с чем: conflict-status: none, conflicts пустой.`} Расхождение о техконтексте (файлы, корпус) сюда не подпадает: техконтекст берётся из дерева. Стек, команды сборки и тестов не выводи - их даёт соседний узел по манифесту. Код не меняй, сборку и тесты не прогоняй: соседний узел в этот момент ставит в это дерево зависимости и прогоняет сборку и тесты.`,
    { label: 'ctx:R-I', phase: 'Context', schema: REQ }, 'Explore'),
])
const prep = tree.p
trail.push(priorTree ? TREE_SKIPPED : { step: '1-tree', doer: 'подготовка дерева', status: prep ? prep.status : 'null', prepare: prep ? prep['prepare-status'] : null, baseline: tree.base.status, baseline_log: tree.base.log, baseline_failing: tree.base.failing })
trail.push({ step: '1-req', doer: ctxResumed ? 'ledger (разведка прошлого прогона)' : 'Explore', status: req ? req.status : 'null' })
if (!prep || prep.status === 'blocked') return nodeBail('Context: подготовка дерева', lack(prep, 'узел подготовки дерева'))
if (!req || req.status === 'blocked') return nodeBail('Context', lack(req, 'узел контекста'))
if (!req.requirements.length) return bail('Context', 'разведка не вывела ни одной единицы R/I - реализовывать нечего')
if (prep.status === 'partial') degraded.push(`подготовка дерева partial: ${prep.missing || 'нехватка не названа'}`)
// Форма ctx общая - её же принимает ledger и подаёт обратно в A.ctx.
ctx = { ...req, stack: prep.stack, build_cmd: prep.build_cmd, test_cmd: prep.test_cmd, report_cmd: prep.report_cmd || '', prepare_cmd: prep.prepare_cmd }
// Провал подготовки - не стоп: дерево лечит кодер первой попыткой, но знать о провале он обязан,
// иначе молча встанет на первой сборке и проест потолок.
if (prep['prepare-status'] === 'failed') degraded.push(`подготовка дерева не удалась: ${prep.prepare_log || 'причина не названа'}`)
const treeBase = baselineOf(tree.base, resuming ? A.trail : null)
if (treeBase && treeBase.fresh && treeBase.status === 'red') degraded.push(`дерево красное до правок трека: ${treeBase.log || 'что упало, не названо'}`)
known = treeBase ? treeBase.failing : []
const baseline = baselineNote(treeBase)
// Выбор стороны в противоречии источников - полномочие владельца требований, не узла: узел, выбравший
// сторону, закрепляет её тестом и коммитом, и решение в пользу второй стоит инверсии теста (зонд P23).
// Перечень судится наравне со статусом: «none» при непустом перечне сам себя опровергает.
const conflicts = ctx.conflicts || []
// Разведку этот исход не переживает (ctx - CTX_RESET): решение владельца меняет источник, из которого она
// выведена, и поданная из ledger она встала бы на том же противоречии по уже исправленным документам.
if (ctx['conflict-status'] === 'some' || conflicts.length) return bail('Context', `противоречие источников требований, выбор стороны не за исполнителем: ${conflicts.join('; ') || 'перечень не назван при conflict-status: some'}`, { ctx: CTX_RESET })
const reqText = ctx.requirements.join('\n')

const DESIGN = { type: 'object', properties: {
  status: STATUS,
  design: { type: 'array', items: { type: 'object', properties: { requirement: { type: 'string' }, device: { type: 'string' }, cost: { type: 'string' }, edges: { type: 'array', items: { type: 'string' } }, consumers: { type: 'array', items: { type: 'string' } }, behaviors: { type: 'array', items: { type: 'string' } } }, required: ['requirement', 'device', 'cost', 'edges', 'consumers', 'behaviors'] } },
  decisions: { type: 'array', items: { type: 'string' } },
  'fact-check': FACT_CHECK('цена операций или поведение стороннего API в решении'),
  missing: { type: 'string' },
}, required: ['status', 'design', 'decisions', 'fact-check', 'missing'] }
const designLines = (d) => d.design.map(x => `- ${x.requirement}: ${x.device}\n  цена: ${x.cost}\n  граничные входы: ${x.edges.join('; ') || 'нет'}\n  потребители: ${x.consumers.join('; ') || 'нет'}\n  поведения под тесты: ${x.behaviors.join('; ') || 'нет'}`).join('\n')

phase('Implement')
// Фаза параметром: verify зовётся и из Review, а фаза берётся из opts, не из phase().
const verifyOnce = (tag, ph = 'Implement') => verifyNode(HEAD, tag, ctx, known, ph)
// Зелёная верификация на цели без прошлого прогона значит «работа не покрыта тестами», а не «сделана»: молча пропустить правку по ней нельзя.
if (A.resume && !resuming) {
  log('«продолжить» без следа прошлого прогона в ledger: трек идёт как первый, фаза правки не пропускается')
  decisions.push('«продолжить» подано без trail: прогона по этой цели в ledger нет, возобновление не применено - трек отработал как первый')
}
// Возобновление начинается с верификации: зелёное дерево с коммитами трека не переделывается, прежние находки несёт ревью (T7a, P115).
if (resuming) {
  ver = await verifyOnce('возобновление')
  trail.push({ step: 'resume', doer: 'general-purpose', passed: passed(ver) })
  if (noRun(ver)) return nodeBail('Implement: верификация при возобновлении', lack(ver, 'верификатор'))
}
// Без коммитов трека прошлый прогон встал до правки: зелёные базовые тесты работу не подтверждают.
const ahead = !!(ver && ver.ahead)
let pending = (!ahead && (ASK.length > 0 || resuming)) || !!priorMissing
// Устройство по цене судит opus до кода: кодер на sonnet ради скорости, и его выбор структуры до ревью никто не судил (P114).
// С коммитами трека решение уже в коде: повторный проектировщик перестраивал бы сделанное (P115).
let design = null
if (!ahead && (!passed(ver) || pending)) {
  design = await own('проектировщик', `${HEAD}${DONE}Шаг 2а: решение по требованиям до кода.\nТребования:\n${reqText}\nФайлы: ${ctx.files.join(', ')}. Тесты: ${ctx.test_cmd || 'нет'}. Сборка: ${ctx.build_cmd || 'нет'}.${baseline}`,
    { label: 'design', phase: 'Implement', schema: DESIGN }, NODE.designer)
  trail.push({ step: '2-design', doer: NODE.designer.agentType, status: design ? design.status : 'null' })
  if (design && design.status === 'blocked') return nodeBail('Design', lack(design, 'проектировщик'))
  if (!design) degraded.push('проектировщик без выхода - кодер проектирует сам')
  else {
    if (design.status === 'partial') degraded.push(`решение проектировщика неполно: ${design.missing || 'нехватка не названа'}`)
    decisions.push(...design.decisions)
  }
}
const unsure = design ? (design['fact-check'] || []).filter(f => !['verified', 'contradicted'].includes(f.status)).map(f => `${f.claim} (${f.status}: ${f.source})`) : []
const refuted = design ? (design['fact-check'] || []).filter(f => f.status === 'contradicted').map(f => `${f.claim} (${f.source})`) : []
const designText = design ? `\nРешение проектировщика:\n${designLines(design)}${unsure.length ? `\nНе подтверждено источником, сверь до опоры: ${unsure.join('; ')}` : ''}${refuted.length ? `\nОпровергнуто источником, не опирайся: ${refuted.join('; ')}` : ''}` : ''
for (let k = 1; k <= FIX_CEILING && (!passed(ver) || pending); k++) {
  loops.fix = k; pending = false
  // red-run прошлой попытки - установленный факт: без него следующая попытка показывает тот же тест красным заново, проедая потолок.
  const shown = (fix && fix['red-run'] || []).filter(r => r.status === 'shown')
  const priorRed = shown.length ? `\nКрасный прогон уже показан прошлой попыткой и перепроверке не подлежит: ${redLines(shown)}` : ''
  const prev = ver && !passed(ver) ? `\n${k === 1 ? 'Верификация при возобновлении' : `Попытка ${k - 1}`} не прошла: ${redNote(ver, known)}.${priorRed}` : ''
  fix = await own('кодер', `${HEAD}${DONE}${OPEN}Шаг 2, попытка ${k} из ${FIX_CEILING}: реализация по требованиям, TDD (тесты на каждую R).\nТребования:\n${reqText}${designText}\nФайлы: ${ctx.files.join(', ')}. Тесты: ${ctx.test_cmd || 'нет'}. Сборка: ${ctx.build_cmd || 'нет'}. ${COVER_ONLY}${prep['prepare-status'] === 'done' ? ` Каталог подготовлен узлом контекста (${ctx.prepare_cmd}) - установку не повторяй.` : prep['prepare-status'] === 'failed' ? ` Подготовка узлом контекста не удалась (${prep.prepare_log || 'причина не названа'}) - до первой сборки выполни её сам: ${ctx.prepare_cmd || 'команда не названа, выведи по манифесту'}` : prep['prepare-status'] === 'skipped' ? ` Каталог подготовлен прошлым прогоном, подготовка не повторялась: сборка упала на зависимостях - выполни ${ctx.prepare_cmd || 'подготовку по манифесту'} сам.` : ''}${baseline}${prev}\nПо завершении: коммит локально (сообщение по цели, без служебной нумерации R), push не делать.`,
    { label: `fix:${k}`, phase: 'Implement', schema: FIX }, NODE.coder)
  trail.push({ step: 2, attempt: k, doer: NODE.coder.agentType, status: fix ? fix.status : 'null', 'red-run': fix ? fix['red-run'] : null })
  if (fix) decisions.push(...said(fix))
  if (!fix || fix.status === 'blocked') return nodeBail(`Implement#${k}`, lack(fix, 'узел-кодер'))
  cmds0 = cmds0 || cmdsOf(ctx)
  ctx = withCommands(ctx, fix)
  ver = await verifyOnce(`после попытки ${k}`)
  trail.push({ step: '2-exit', attempt: k, doer: 'general-purpose', passed: passed(ver) })
  if (noRun(ver)) return nodeBail(`Implement#${k}: верификация`, lack(ver, 'верификатор'))
  if (!passed(ver)) log(`попытка ${k}: exit=${ver && ver.exit_code}, build_ok=${ver && ver.build_ok}, fail=${ver && ver.fail_count}, dirty=${ver && ver.dirty}`)
}
if (!passed(ver)) return outcome('partial', `Implement: потолок ${FIX_CEILING} исчерпан`, `дерево не зелёное после ${FIX_CEILING} попыток: ${redNote(ver, known)}`, { ver, ctx, fix, decisions: dec() })

phase('Review')
// Разведка этого прогона - другое намерение: коммиты до прежней базы судились против прежних требований.
const firstBase = priorBase(resuming && ctxResumed ? A.trail : null)
const review = (tag, f, v, priors, base, h) => own('саморевьюер', `${HEAD}Шаг 3 (${tag}): pre-push саморевью локальной ветки - ${scope(base)}${hunkList(spotsOf(h))}${conventionsText(h)}${swapText(cmds0, ctx)}${coderInput(f)} Источник намерения - требования:\n${reqText}${design ? `\nРешение проектировщика: код, отступивший от него без пункта плана кодера с причиной, - находка.\n${designLines(design)}` : ''}${priors.length ? `\n${LISTED}\n${priors.map(listedLine).join('\n')}` : ''}${RESUMED}\nПрогон build/test реальный, итог - в run-status, не в findings. Код не меняй.`,
  { label: `self-review:${tag}`, phase: 'Review', schema: { type: 'object', properties: { ...REVIEW.properties, 'conventions-read': conventionsRead(h) }, required: [...REVIEW.required] } }, NODE.reviewer)
const loop = await reviewLoop({ fix, ver, firstBase, review, coder: async (p) => { const f = await own('кодер', p, { label: 'fix:after-review', phase: 'Review', schema: FIX }, NODE.coder); cmds0 = cmds0 || cmdsOf(ctx); ctx = withCommands(ctx, f); return f }, intent: () => `Требования:\n${reqText}${designText}`,
  verify: (tag, from) => verifyNode(HEAD, tag, ctx, known, 'Review', { delta_from: from }), afterCoder: () => null, afterVerify: () => {}, checkNote: () => swapText(cmds0, ctx),
  run: () => `Тесты: ${ctx.test_cmd || 'нет'}. Сборка: ${ctx.build_cmd || 'нет'}. ${COVER_ONLY}`, red: (v) => redNote(v, known) })
if (loop.exit) return loop.exit
const { rev, fal, chk, reg, spots, dropped } = loop
const trace = traceGap(rev, spots, fal, reg.all())
if (trace) degraded.push(trace)
fix2 = loop.fix2; ver2 = loop.ver2
const finalVer = ver2 || ver
const gap = coderGap(fix, fix2, loop.offeredOnly)
const green = passed(finalVer)
if (green && inheritedFails(finalVer, known).length) degraded.push(`падения базы не исправлены и правке не вменены: ${inheritedFails(finalVer, known).join('; ')}`)
const gaps = [ledgerUnread ? LEDGER_UNREAD : '', req.status === 'partial' ? `разведка требований неполна: ${req.missing || 'нехватка не названа'}` : '', !ctx.build_cmd && !ctx.test_cmd ? 'внешнего факта нет: ни сборки, ни тестов' : '', finalVer && !finalVer.ahead ? 'коммитов трека нет' : '', reviewGap(rev, fal, chk), gap].filter(Boolean).join('; ')
const where = admit(green, rev, reg.holding(), gaps)
return outcome(where ? 'partial' : 'complete', where, where, {
  goal_check: { build_ok: !!finalVer && finalVer.build_ok, tests_green: !!finalVer && finalVer.exit_code === 0 && finalVer.fail_count === 0, inherited: inheritedFails(finalVer, known), committed: !!finalVer && !finalVer.dirty && finalVer.ahead > 0, head: finalVer ? finalVer.head : '' },
  ctx, fix, fix_after_review: fix2, review: rev, falsify: fal, prior: reg.all(), dropped,
  decisions: [...dec(), ...askLines(reg)],
})
