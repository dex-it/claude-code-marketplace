// Трек bugfix как Workflow-скрипт (artifacts.md, O12 вариант A). Ядро - узел dex-auto:debugger на воспроизведении и первопричине,
// фикс - узел dex-auto:coder (коммит в его контракте, у диагноста - нет). Модель находки, узел-обёртка, верификация и саморевью - общие фрагменты tracks-shared.
// Вход через args: { task, symptom, expected, env, done, boundary, mode, cwd, source, goal_path, resume, trail, open_findings, repro }.
export const meta = {
  name: 'dex-auto-bugfix',
  description: 'Трек bugfix: подготовка дерева -> воспроизведение и первопричина (debugger) -> фикс кодером с верификацией (потолок 3) -> саморевью -> правка по находкам (потолок 2) с повторным ревью',
  phases: [
    { title: 'Context', detail: 'подготовка дерева по манифесту стека, команды сборки и тестов' },
    { title: 'Reproduce', detail: 'debugger: красный воспроизводящий тест либо прослеженный путь, первопричина, предложение фикса; продуктовый код не меняет' },
    { title: 'Fix', detail: 'кодер принимает диагноз и лечит первопричину x верификация внешним фактом, потолок 3; спор с диагнозом - к оператору, продолжение зовёт диагноста с уликой (фаза Reproduce); при возобновлении - сначала верификация' },
    { title: 'Review', detail: 'саморевью со скептиком; находки, держащие порог, - правка с верификацией и повторное ревью после каждой; потолки: правок 2, ревью 3' },
  ],
}

const A = args || {}
const FIX_CEILING = 3, REVIEW_FIX_CEILING = 2, REVIEW_CEILING = 3
// Каталог, стоп-линии и отсутствие оператора одинаковы для любого узла трека; симптом и критерий
// несёт только тот, кто их исполняет.
const TREE = `Рабочий каталог - ${A.cwd} на текущей ветке, процесс уже в нём; всё незакоммиченное в нём - от этой работы. Ветку не переключай. Стоп-линия: push, деплой, миграции данных, удаление вне рабочего каталога. Оператора нет: невыводимое не додумывай - status: blocked, нехватка в missing.\n`
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
const HEAD = `mode: ${A.mode || 'autonomous'}\nцель (${A.task}): починить баг - симптом: ${A.symptom}\nожидаемое: ${A.expected || 'не задано - реконструируй из тестов и корпуса, назови основание'}\nокружение: ${A.env || 'не задано'}\nкритерий «готово»: ${fromGoal(A.done, 'не подан', 'Критерий «готово»', 'не подан')}\nграница: ${fromGoal(A.boundary, 'не подана', 'Граница', 'не выходить за рабочий каталог')}\nфайл цели: ${A.goal_path || 'нет'}\ndecision-log: n/a (трек журнал решений не ведёт; решения - полем decisions)\n${TREE}`
// Узел подготовки симптома не получает: прочитав его первой строкой, он чинит баг сам, и хвостовой
// запрет его не держит (зонд P25). Предмет узла - дерево, и шапка несёт только его.
const PREP_HEAD = `mode: ${A.mode || 'autonomous'}\nзадача (${A.task}): подготовить рабочий каталог к сборке и тестам - и только это: баг чинят следующие узлы.\n${TREE}`
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
    // Важность записи только растёт: повторное ревью, поднявшее P2 до P1, должно держать порог допуска.
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
const checkGap = (rev, fal) => {
  const found = [...(fal.confirmed || []), ...(fal.prior || [])]
  return [silentGap(rev.findings, fal), axesCheckGap(rev.axes, fal['axes-check'], found), rootsCheckGap(rev.roots, fal['roots-check'], found), rootsMissedGap(fal['roots-missed'], rev.roots)].filter(Boolean).join('; ')
}
// Места правки снимает не ревьюер: перечень, собранный тем, чью полноту он проверяет, ничего не проверяет.
const hunkList = (hunks) => (hunks || []).length ? `\nМеста правки (без тестов) - каждое пересекает запись roots: решение либо none с причиной:\n${hunks.map(h => `- ${h}`).join('\n')}` : ''
const hunkGap = (hunks, roots) => {
  const bare = (hunks || []).filter(h => !(roots || []).some(x => sameSpot(h, x.anchor)))
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
const cmdsOf = (t) => ({ build_cmd: String((t && t.build_cmd) || '').trim(), test_cmd: String((t && t.test_cmd) || '').trim() })
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
    closure: FINDING.properties.closure, evidence: FINDING.properties.evidence, premise: FINDING.properties.premise,
    continues: { type: 'string', description: 'id прежней находки из перечня, чьё решение находка продолжает новым путём; иначе пусто' } },
  required: ['ref', 'anchor', 'severity', 'axis', 'text', 'closure', 'evidence', 'premise', 'continues'] }, description: 'только находки, которых нет в перечне прежних' },
  axes: AXES,
  roots: ROOTS,
  'run-status': { type: 'string', description: 'прогон свой, не пересказ входа' },
  'red-run': { type: 'string', description: 'вердикт по записям red-run кодера во входе: по каждому тесту дельты запись действует / красным не показан (unverifiable кодера) / отсутствует / истекла; записей не было - unverifiable + что искал; тестов в дельте нет - n/a' },
  'fact-check': FACT_CHECK('техутверждения находок о стороннем API'),
  'conventions-read': CONVENTIONS_READ,
  intent: { type: 'string', description: 'сверка с источником намерения входа: соответствует / расхождения «корректно, но не то»; источника нет - n/a' },
  'intent-status': { type: 'string', enum: ['match', 'mismatch', 'n/a'], description: 'mismatch - сделано не то, чего требует источник намерения входа; подробности в intent' },
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
// Место находки, дописанное скептиком (places), есть только в реестре: без него решение на этом месте числится без находки.
const reviewGap = (r, reg = []) => !r || r.status === 'blocked' ? '' : r.status === 'partial' ? `саморевью не завершено: ${r.missing || 'нехватка не названа'}` : r['intent-status'] === 'mismatch' ? `саморевью: реализовано не то: ${r.intent}` : axesGap(r.axes, r.findings) ? `саморевью: ${axesGap(r.axes, r.findings)}` : rootsGap(r.roots, [...(r.findings || []), ...(r.prior || []), ...reg]) ? `саморевью: ${rootsGap(r.roots, [...(r.findings || []), ...(r.prior || []), ...reg])}` : ''
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
// Ветку до head ревью complete уже прочли: повторное чтение всего диффа ветки - главная статья прогона дочистки.
// Ревью с разрывом снимка либо скептика базой не служит: дельта от него унесла бы непроверенное из объёма.
// Диагноз либо разведка, выведенные узлом, а не взятые из ledger, - новое намерение: ревью до них судили прежнее.
const INTENT_STEPS = ['1-repro', '1-req']
const priorBase = (trail) => {
  const all = steps(trail), from = all.reduce((k, e, i) => INTENT_STEPS.includes(e.step) && !/^ledger/.test(e.doer || '') ? i : k, -1)
  return (all.slice(from + 1).filter(e => (e.step === 3 || e.step === '3-repeat') && e.status === 'complete' && e.settled !== false && isSha(e.head)).pop() || {}).head || ''
}
const scope = (base) => base ? `дельта от ${base} - коммиты после него плюс рабочее дерево. Новые находки ищи в дельте, вне её - только сломанное правкой дельты; статус прежних находок перечня суди на текущем коде. ${base} не предок HEAD - ревью по всем коммитам цели.` : 'коммиты этой цели плюс рабочее дерево.'
// Пара «новая - прежняя» - факт поля узла: какой механизм тот же, судит ревьюер, трек лишь сверяет id с поданным перечнем.
// Находка с пробой с любой стороны пары кодеру не подаётся - размотать её ему нечем (I10).
// В реестре - запись скептика, его текст и место могут отличаться от ревьюера: id ищется по пересечению места и оси.
// Пара заводится только у находки, которая правится в прогоне: иначе кодеру задано размотать то, что ему не подано.
const pairsOf = (reg, r, listed, degraded) => (r && r.status !== 'blocked' ? r.findings : []).filter(f => String(f.continues || '').trim()).map(f => {
  const of = String(f.continues).trim(), earlier = listed.find(q => q.id === of), shut = shutBy(r)
  const at = reg.all().find(q => !listed.some(l => l.id === q.id) && sameSpot(q.anchor, f.anchor) && (q.axis || '') === (f.axis || '')) || listed.find(q => q.anchor === f.anchor && q.axis && q.axis === f.axis && !shut.includes(q.id))
  if (!toFix(at || { ...f, status: 'open' })) return null
  if (!earlier) { degraded.push(`саморевьюер: находка ${f.anchor} продолжает ${of} - id вне поданного перечня, пара не принята`); return null }
  if (awaitsProbe(earlier)) return null
  return { id: at ? at.id : f.anchor, of }
}).filter(Boolean)
const unwindOf = (chain, listed) => chain.length ? `\nНовый путь прежнего механизма: ${chain.map(p => `${p.id} продолжает ${p.of}`).join('; ')}. Прежние:\n${listed.filter(q => chain.some(p => p.of === q.id)).map(findingLine).join('\n')}\nРазмотай решение по всем входам и состояниям, где оно ошибается, и закрой разом; пути - в evidence записи prior.` : ''
const pairDecision = (p) => `${p.id} продолжает ${p.of}: правка по ${p.of} закрыла путь, а не механизм - кодеру задано размотать решение, повторное ревью куплено`
const pairLeft = (p) => `${p.id} продолжает ${p.of}: механизм не размотан правкой по находкам`
const HUNKS = { type: 'object', properties: {
  status: STATUS,
  hunks: { type: 'array', items: { type: 'string' }, description: 'путь от корня репозитория без a/ и b/, место file:from-to по +start,count заголовка @@ (from = start, to = start+count-1); только удалённые строки (count 0) - file:start; удалённый файл - file' },
  conventions: CONVENTIONS.conventions, 'conventions-searched': CONVENTIONS['conventions-searched'],
  missing: { type: 'string' },
}, required: ['status', 'hunks', 'conventions', 'conventions-searched', 'missing'] }
// Места правки считает скрипт: арифметику заголовков @@ модель путает на единицу; узлу остаётся отсев файлов тестов.
// Сомнение, относится ли документ к правке, снимок выражал статусом partial - и тот покупал повторное ревью.
const HUNKS_STATUS = 'Документ, о котором неясно, относится ли он к правке, включи в conventions. status - complete, когда места сняты; partial - только когда места сняты не целиком.'
const hunksAsk = (base) => A.scripts ? `ТОЛЬКО перечень мест правки и правил проекта, код не менять. Выполни python3 '${A.scripts}/verify.py' --hunks${base ? ` ${base}` : ''}: hunks - поле hunks его вывода как есть, без файлов тестов; поле error в выводе либо вывод не JSON - status partial, error либо последние строки вывода в missing. ${conventionsAsk} ${HUNKS_STATUS}`
  : `ТОЛЬКО перечень мест правки и правил проекта, код не менять. ${base ? `git diff -U0 ${base}; ${base} не предок HEAD (git merge-base --is-ancestor) - как без базы. ` : ''}Без базы - git diff -U0 "$(${OWN_COMMITS} | tail -1)^", своих коммитов нет - git diff -U0 HEAD. Место - путь от корня репозитория без a/ и b/, место file:from-to по +start,count заголовка @@ (from = start, to = start+count-1); только удалённые строки (count 0) - file:start; удалённый файл - file. Файлы тестов не включай. ${conventionsAsk} ${HUNKS_STATUS}`
const hunksOf = (tag, base) => node('снимок правки', `${HEAD}Шаг 3 (${tag}): ${hunksAsk(base)}`, { label: `hunks:${tag}`, phase: 'Review', model: 'haiku', effort: 'low', schema: HUNKS })
const spotsOf = (h) => h && h.status !== 'blocked' ? h.hunks : []
const doubted = (rev, listed) => listed.map(p => { const c = (rev.prior || []).find(q => q.id === p.id); return `${priorLine(p)} - саморевьюер: ${c ? `${c.status} - ${c.evidence}` : 'статус не назван'}` }).join('\n')
// Разрывы ревью - тот же перечень, что у итога: ревью без правки покупается ради них.
const lapGaps = (rev, h, fal, reg) => [reviewGap(rev, reg), spotGap(rev, h), falsifyGap(rev, fal)].filter(Boolean).join('; ')
const gapAsk = (g) => g ? `\nКод с прежнего ревью этой базы не менялся; оно оставило разрывы - закрой их, прочий объём суди штатно: ${g}` : ''
const falsifyOf = (tag, rev, listed, base, h, gaps = '') => own('скептик', `${HEAD}Шаг 3 (${tag}): фальсификация находок, исходов осей, решений и статусов прежних из саморевью; вердикт по покрытию. Объём - ${scope(base)} Код не меняй.${conventionsText(h)}${gapAsk(gaps)}\nНаходки:\n${rev.findings.map(findingLine).join('\n') || '- находок нет: только вердикт по покрытию'}${listed.length ? `\nПрежние находки - статус саморевьюера:\n${doubted(rev, listed)}` : ''}\nОси саморевьюера:\n${axesText(rev.axes)}\nРешения саморевьюера:\n${rootsText(rev.roots)}`,
  { label: `falsify:${tag}`, phase: 'Review', schema: FALSIFY }, NODE.skeptic)
const judged = (fal) => !!fal && fal.status !== 'blocked' && !fal.skipped
// Сверка стоит как само ревью, а без P0/P1 исход итога от неё не зависит (P115).
const needsSkeptic = (rev, listed) => [...rev.findings, ...listed].some(isBlocking)
const SKIPPED = { skipped: true, status: 'skipped', confirmed: [], dropped: [], prior: [] }
// В реестр входит выход скептика; без него - claims ревьюера, и разрыв не выпускает complete.
const verdictOf = (rev, fal) => judged(fal) ? { status: fal.status, findings: fal.confirmed, prior: fal.prior } : rev
// Пара continues - поле ревьюера: держится, пока скептик подтвердил находку; место и ось - записи скептика, по ним её id в реестре.
const kept = (rev, fal) => !rev || !judged(fal) ? rev : { ...rev, findings: rev.findings.flatMap(f => { const c = fal.confirmed.find(c => sameFinding(c, f) && (!!(c.ref && f.ref) || c.axis === f.axis)); return c ? [{ ...f, anchor: c.anchor, axis: c.axis }] : [] }) }
const settledOf = (rev, h, fal) => !spotGap(rev, h) && !falsifyGap(rev, fal)
const spotGap = (rev, h) => !rev || rev.status === 'blocked' ? '' : !h || h.status === 'blocked' ? `места правки не сняты: ${lack(h, 'снимок правки')}`
  : [h.status === 'partial' ? `места правки сняты не целиком: ${h.missing || 'нехватка не названа'}` : '', hunkGap(h.hunks, rev.roots) ? `саморевью: ${hunkGap(h.hunks, rev.roots)}` : '', conventionsGap(h, rev) ? `саморевью: ${conventionsGap(h, rev)}` : ''].filter(Boolean).join('; ')
const falsifyGap = (rev, fal) => !rev || rev.status === 'blocked' || (fal && fal.skipped) ? '' : !judged(fal) ? `фальсификация саморевью не выполнена: ${lack(fal, 'скептик')}`
  : [fal.status === 'partial' ? `фальсификация саморевью не завершена: ${fal.missing || 'нехватка не названа'}` : '', checkGap(rev, fal) ? `саморевью: ${checkGap(rev, fal)}` : ''].filter(Boolean).join('; ')
// <<< shared: self-review
// >>> shared: review-loop
const KEEP = 'Инварианты правки - источник намерения ниже и закрытые в этом прогоне находки: правка их не нарушает и не сужает поведение допущением о входе или среде, которого в источнике нет; такое допущение находку не закрывает.'
const keepText = (closed) => `\n${KEEP}${closed.length ? `\nЗакрытые в этом прогоне:\n${closed.map(f => `- ${f.id} ${f.anchor}: ${f.closure || f.text}`).join('\n')}` : ''}`
const deltaOf = (v) => v && Array.isArray(v.delta) ? v.delta : null
// Цикл - docs/domain.md §4; t несёт различия треков: review, coder, intent, run (команды прогона), verify, red (итог незелёной верификации либо ''), afterCoder (выход трека либо null), afterVerify, moved (необязательный: сменила ли правка то, что судит только ревью, - тест диагноста bugfix; true - пропуска ревью нет).
const OFFERED = 'На твоё решение - порога не держат: правь, только если правка не выходит за места, которые уже меняет правка цели либо называет находка, и не меняет наблюдаемого поведения вне находки; иначе запись prior disputed с основанием.'
async function reviewLoop(t) {
  const { fix, ver, firstBase } = t
  let fix2 = null, ver2 = null, deltaFrom = null, red = '', offeredOnly = false
  let spots = await hunksOf('первое', firstBase)
  let rev = await t.review('первое', fix, ver, LEDGER, firstBase, spots); loops.review = 1
  const first = { step: 3, doer: NODE.reviewer.agentType, status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1, verdict: rev ? rev['review-verdict'] : null, head: shaOf(ver), base: firstBase }
  trail.push(first)
  const dropped = []
  // Ревью без правки, купленное разрывом сверки, без скептика закрыло бы разрыв молчанием.
  const falsify = async (tag, r, listed, base, h, gaps, recheck = false) => {
    if (!r || r.status === 'blocked') return null
    const step = tag === 'первое' ? '3-falsify' : '3-repeat-falsify'
    if (!recheck && !needsSkeptic(r, listed)) { trail.push({ step, doer: 'не куплен: P0/P1 нет', status: 'skipped' }); return SKIPPED }
    const f = await falsifyOf(tag, r, listed, base, h, gaps)
    trail.push({ step, doer: NODE.skeptic.agentType, status: f ? f.status : 'null', confirmed: f ? f.confirmed.length : -1, dropped: f ? f.dropped.length : -1 })
    if (judged(f)) dropped.push(...f.dropped)
    return f
  }
  let fal = await falsify('первое', rev, LEDGER, firstBase, spots)
  const reg = registry(UNSETTLED)
  LEDGER.forEach(reg.doubt)
  reg.apply(verdictOf(rev, fal), judged(fal) ? 'скептик' : 'саморевьюер')
  // Ревью со своим разрывом базой дельты не служит: повторное по дельте не перепроверило бы место разрыва.
  first.settled = settledOf(rev, spots, fal) && !reviewGap(rev, reg.all())
  const offeredHere = new Set()
  let last = first, listed = LEDGER, chain = pairsOf(reg, kept(rev, fal), LEDGER, degraded), base = firstBase
  const advance = () => { if (last.settled && rev && rev.status === 'complete') base = last.head }
  // Вопрос оператору (domain.md §2) едет и в выходе из цикла: иначе P2 видна только записью prior.
  const state = (exit) => ({ exit: exit && { ...exit, decisions: [...(exit.decisions || []), ...askLines(reg)] }, rev, fal, reg, spots, fix2, ver2, dropped, offeredOnly })
  advance()
  while (rev && rev.status !== 'blocked') {
    const reviewLeft = loops.review < REVIEW_CEILING
    let gaps = '', recheck = false
    // Не держащая порог подаётся кодеру один раз: оспоренная им осталась бы открытой и гоняла круги до потолка.
    const may = reg.offers().filter(f => !offeredHere.has(f.id))
    if ((reg.fixes().length || may.length || red) && loops.review_fix < REVIEW_FIX_CEILING && reviewLeft) {
      const k = ++loops.review_fix, must = reg.fixes().length > 0 || !!red
      may.forEach(f => offeredHere.add(f.id))
      if (deltaFrom === null) deltaFrom = shaOf(ver2 || ver)
      decisions.push(...chain.map(pairDecision))
      fix2 = await t.coder(`${HEAD}Шаг 2 (правка по находкам ${k} из ${REVIEW_FIX_CEILING}):${red ? ` верификация прошлой правки не прошла: ${red}.` : ''}${reg.fixes().length ? ` закрой находки:\n${reg.fixes().map(findingLine).join('\n')}` : ''}${may.length ? `\n${OFFERED}\n${may.map(findingLine).join('\n')}` : ''}${unwindOf(chain, listed)}${keepText(reg.closed())}\n${t.intent()}\n${t.run()}\nПосле правки коммит локально, push не делать. По каждой находке - запись в prior с её id: closed с уликой либо disputed с основанием, почему закрывать не следует.`)
      if (fix2) decisions.push(...said(fix2))
      const exit = fix2 && t.afterCoder(fix2, k, { review: rev, prior: reg.all() })
      if (exit) return state(exit)
      const prevVer = ver2 || ver
      ver2 = !fix2 || fix2.status === 'blocked' ? null : await t.verify('после саморевью', deltaFrom)
      t.afterVerify(ver2)
      offeredOnly = !must
      trail.push({ step: '2-after-review', attempt: k, doer: NODE.coder.agentType, status: fix2 ? fix2.status : 'null', passed: passed(ver2), 'red-run': fix2 ? fix2['red-run'] : null })
      const openNow = { review: rev, falsify: fal, prior: reg.all(), dropped }
      if (!fix2 || fix2.status === 'blocked') return state(bail('Review: правка по находкам', lack(fix2, 'узел-кодер'), openNow))
      if (noRun(ver2)) return state(bail('Review: верификация после правки', lack(ver2, 'верификатор'), openNow))
      // Зелёная правка одних offered ревью не покупает: их исход итога не держит (domain.md §4); сменивший тест диагноста круг пропуска не получает (t.moved).
      if (!must && passed(ver2) && last.settled && !(t.moved && t.moved(prevVer, ver2))) {
        const shut = (fix2.prior || []).filter(p => p.status === 'closed' && may.some(f => f.id === p.id))
        shut.forEach(p => reg.seat(p, 'closed', `закрыто кодером без повторного ревью: ${p.evidence}`))
        decisions.push(...shut.map(p => `${p.id}: закрыто кодером без повторного ревью - ${p.evidence}`))
        trail.push({ step: '3-repeat', doer: 'не куплено: правка одних offered, верификация зелёная', status: 'skipped', closed: shut.length })
        break
      }
      red = passed(ver2) ? '' : t.red(ver2)
      if (!deltaOf(ver2)) degraded.push(`дельта правки по находкам ${k} не получена - новые находки ревью после неё считаются внесёнными правкой`)
    } else if (last.settled || rev['intent-status'] === 'mismatch' || !reviewLeft) break
    else { gaps = lapGaps(rev, spots, fal, reg.all()); recheck = !!falsifyGap(rev, fal) }
    listed = loops.review_fix ? reg.listing() : reg.open()
    spots = await hunksOf('повторное', base)
    rev = await t.review('повторное', fix2 || fix, ver2 || ver, listed, base, spots, gaps); loops.review++
    fal = await falsify('повторное', rev, listed, base, spots, gaps, recheck)
    // Повторное без выхода или blocked статусов не выносит: реестр остаётся, каким его оставило прежнее.
    if (rev && rev.status !== 'blocked') listed.forEach(reg.doubt)
    reg.apply(verdictOf(rev, fal), judged(fal) ? 'скептик (повторное)' : 'саморевьюер (повторное)', listed, loops.review_fix ? introducedAt(deltaOf(ver2)) : null)
    chain = pairsOf(reg, kept(rev, fal), listed, degraded)
    last = { step: '3-repeat', doer: NODE.reviewer.agentType, status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1, verdict: rev ? rev['review-verdict'] : null, head: shaOf(ver2 || ver), base, settled: settledOf(rev, spots, fal) && !reviewGap(rev, reg.all()) }
    trail.push(last)
    advance()
  }
  decisions.push(...chain.map(pairLeft))
  return state(null)
}
// <<< shared: review-loop
const REPRO = { type: 'object', properties: {
  status: STATUS,
  root_cause: { type: 'string', description: 'первопричина с привязкой файл:строка, не симптом; не установлена (гейт первопричины, нужен runtime) - пусто, почему - в missing' },
  reproduction: { type: 'string', description: '"тест <имя>: красный на коммите <git rev-parse HEAD при прогоне; незакоммиченные правки продукта - SHA коммит-объекта этого состояния без правки дерева и индекса (временный индекс: read-tree HEAD, add -A, write-tree, commit-tree -p HEAD)>, <вывод>, причина падения сверена" либо прослеженный путь от входа до места сбоя и почему без теста' },
  // Снимок теста - опора сверки: правку проверки ловит прогон снимка, а не отчёт кодера.
  repro_test: { type: 'string', description: 'путь воспроизводящего теста, оставленного в дереве красным; теста нет - пусто' },
  repro_blob: { type: 'string', description: 'вывод git hash-object -w <путь теста> после его записи; теста нет - пусто' },
  'expected-basis': { type: 'string', description: 'откуда взято ожидаемое: вход, тест, корпус, реконструкция' },
  // Шаг без следа в выходе не наблюдаем: опровержение причины, не названное полем, пропускается молча.
  falsification: { type: 'array', items: { type: 'object', properties: { prediction: { type: 'string' }, observation: { type: 'string' }, outcome: { type: 'string', enum: ['held', 'refuted'] } }, required: ['prediction', 'observation', 'outcome'] }, description: 'попытки опровергнуть причину: prediction - что обязано наблюдаться, будь причина верна, observation - что видно, с файл:строка или выводом прогона, outcome - held: причина устояла, refuted: снята' },
  'fact-check': FACT_CHECK('утверждения о стороннем API в основе причины'),
  fix_proposal: { type: 'string', description: 'решение исправления: неверное решение кода, все входы и места, где оно ошибается и повторено; исправленное решение и цена операций; граничные входы с исходом; поведения под тесты' },
  files: { type: 'array', items: { type: 'string' } },
  // Ожидаемое берётся из нескольких источников сразу, и они расходятся: вход цели против критерия
  // приёмки владельца в корпусе. Узел, выбравший сторону, чинит под неё и закрепляет тестом (зонд P23).
  'conflict-status': { type: 'string', enum: ['none', 'some'], description: 'противоречие между источниками ожидаемого: none - нет, some - перечень в conflicts' },
  conflicts: { type: 'array', items: { type: 'string' }, description: 'при some - каждое противоречие строкой: якорь обеих сторон и что требует каждая; иначе пустой' },
  missing: { type: 'string', description: 'при blocked - чего не хватает и у кого это есть' },
}, required: ['status', 'root_cause', 'reproduction', 'repro_test', 'repro_blob', 'expected-basis', 'falsification', 'fact-check', 'fix_proposal', 'files', 'conflict-status', 'conflicts', 'missing'] }
// Приёмка диагноза - часть контракта кодера только в этом треке: общая схема правки расширяется, а не копируется.
const BFIX = { type: 'object', properties: {
  ...FIX.properties,
  'diagnosis-check': { type: 'string', enum: ['accepted', 'harness-fixed', 'disputed-test', 'disputed-cause', 'disputed-expected', 'n/a'] },
  dispute: { type: 'string' },
}, required: [...FIX.required, 'diagnosis-check', 'dispute'] }
const BVERIFY = { type: 'object', properties: {
  ...VERIFY.properties,
  repro_test_hash: { type: 'string', description: 'git hash-object -w <путь теста диагноста>; путь не назван - пусто; файла нет - "missing"' },
}, required: [...VERIFY.required, 'repro_test_hash'] }
const BSNAP = { type: 'object', properties: {
  ...BVERIFY.properties,
  snap_hash: { type: 'string', description: 'git hash-object <путь теста> сразу после git show, до сборки; git show упал - его вывод' },
}, required: [...BVERIFY.required, 'snap_hash'] }
const loops = { fix: 0, review_fix: 0, review: 0 }
const trail = [], degraded = [...goalLack]
const unfedArgs = unfed(A, ['task', 'cwd', 'symptom'])
if (unfedArgs.length) return outcome('blocked', 'Context', `трек вызван без входа: нет ${unfedArgs.join(', ')}`)
const LEDGER = resuming ? ledgerList(A.open_findings, 'находки прошлого прогона кодеру не поданы') : []
const ASK = LEDGER.filter(f => !awaitsProbe(f))
const OPEN = ASK.length ? `\nНезакрытые находки прошлого прогона (из ledger): по каждой - запись в prior с тем же id: closed с уликой либо disputed с основанием, почему закрывать не следует:\n${ASK.map(findingLine).join('\n')}\n` : ''
let repro = null, fix = null, fix2 = null, ver = null, ver2 = null, cmds0 = null
const disputes = []
// Решения копятся по попыткам: fix перезаписывается каждым кругом, и без накопления в ledger уезжает только последний.
const decisions = []
const dec = () => decisions.slice()
const bail = (where, missing, extra) => outcome('blocked', where, missing, { decisions: dec(), repro, fix, ...extra })
// Падения базы до правок: правке не вменяются.
let known = []
const passed = (v) => isGreen(v, repro && repro.test_cmd, known)

// Вход собирает /auto; workflow, вызванный по имени, приходит без него - узлы без цели и каталога не запускаются (T0).
const noInput = ['task', 'symptom', 'cwd'].filter(k => !String(A[k] || '').trim())
if (noInput.length) return outcome('blocked', 'Context', `трек вызван без входа: нет ${noInput.join(', ')}`)
phase('Context')
const BASE_HEAD = `mode: ${A.mode || 'autonomous'}\nзадача (${A.task}): замерить сборку и тесты до правок трека - и только это.\n${TREE}`
const legacyRun = (t) => `Выполни ${t.build_cmd ? `сборку: ${t.build_cmd}; ` : ''}${t.test_cmd ? `тесты: ${t.test_cmd}` : 'тестов нет - build_ok по сборке, счётчики 0'}; затем ${VERIFY_CMDS}`
const verifyNode = async (head, tag, ph, schema, body) => {
  const v = await node('верификатор', `${head}Верификация (${tag}): ТОЛЬКО прогон и отчёт, код не менять${body}`, { label: `verify:${tag}`, phase: ph, model: 'haiku', effort: 'low', schema })
  if (v && Array.isArray(v.flaky) && v.flaky.length) decisions.push(`верификация (${tag}): нестабильные тесты - упали и прошли в повторе: ${v.flaky.join('; ')}`)
  return v
}
if (!A.scripts) degraded.push(NO_SCRIPTS)
// Поле возобновления кладёт главный поток из ledger, но подать он может что угодно: непроверенная
// форма роняла соседний трек на первом же обращении к разведке (зонд P25). Непригодное поле трек не
// останавливает - воспроизведение покупается узлом, а подмена названа оператору.
// Без trail прогона не было: repro без него - не след, трек идёт как первый.
const ledgerRepro = resuming ? fromLedger(A.repro) : null
const reproFormed = !!ledgerRepro && typeof ledgerRepro.root_cause === 'string' && Array.isArray(ledgerRepro.files)
// Диагноз без причины прошлого прогона - законная форма, не подмена: он покупается заново без пометки.
// Оспоренный кодером до приёмки - тоже, с его уликой: «продолжить» после спора и есть решение оператора вернуть его диагносту.
const reproResumed = reproFormed && ledgerRepro.root_cause && !ledgerRepro.dispute ? ledgerRepro : null
const priorDispute = reproFormed && ledgerRepro.dispute ? `${ledgerRepro.dispute}${ledgerRepro.repro_test ? ` (тест прежнего диагноза: ${ledgerRepro.repro_test})` : ''}` : ''
if (priorDispute) disputes.push(`прежний спор (из ledger): ${ledgerRepro.dispute}`)
// Судится поданное, а не разобранное: строка не JSON разбирается в null и иначе прошла бы молча (R1).
if (resuming && A.repro && !reproFormed) degraded.push('поле repro подано не в форме воспроизведения (нужны root_cause строкой и перечень files) - диагност вызван заново')

const priorTree = priorPrep(reproResumed, resuming ? A.trail : null)
// С диагностом не параллельно: воспроизведение идёт по подготовленному дереву, а два узла, ставящие
// зависимости и гоняющие тесты в одном дереве, портят прогон друг другу.
const prep = priorTree || await node('подготовка дерева', `${PREP_HEAD}Шаг 1 (техконтекст и подготовка):\n${PREP_STEPS}`, { label: 'ctx:tree', phase: 'Context', model: 'haiku', schema: PREP })
// База - до диагноста: его красный тест в дереве замер исказил бы.
const skip = baseSkip(prep, resuming ? A.trail : null)
const base = skip ? { status: 'n/a', log: skip, failing: [] }
  : baseFrom(await verifyNode(BASE_HEAD, 'база', 'Context', VERIFY, `. ${A.scripts ? verifyRun(A.scripts, verifySpec(prep, [])) : `${legacyRun(prep)}. Числа - из вывода раннера как есть.`}`))
trail.push(priorTree ? TREE_SKIPPED
  : { step: '1-tree', doer: 'подготовка дерева', status: prep ? prep.status : 'null', prepare: prep ? prep['prepare-status'] : null, baseline: base.status, baseline_log: base.log, baseline_failing: base.failing })
if (!prep || prep.status === 'blocked') return bail('Context: подготовка дерева', lack(prep, 'узел подготовки дерева'))
if (prep.status === 'partial') degraded.push(`подготовка дерева partial: ${prep.missing || 'нехватка не названа'}`)
// Провал подготовки - не стоп: дерево лечит следующий узел, но знать о провале он обязан, иначе
// примет падение установки за падение продукта и назовёт первопричиной его.
if (prep['prepare-status'] === 'failed') degraded.push(`подготовка дерева не удалась: ${prep.prepare_log || 'причина не названа'}`)
const treeBase = baselineOf(base, resuming ? A.trail : null)
if (treeBase && treeBase.fresh && treeBase.status === 'red') degraded.push(`дерево красное до правок трека: ${treeBase.log || 'что упало, не названо'}`)
known = treeBase ? treeBase.failing : []
const treeState = `${prep['prepare-status'] === 'done' ? ` Каталог подготовлен узлом контекста (${prep.prepare_cmd}) - установку не повторяй.` : prep['prepare-status'] === 'failed' ? ` Подготовка узлом контекста не удалась (${prep.prepare_log || 'причина не названа'}) - до первого прогона выполни её сам: ${prep.prepare_cmd || 'команда не названа, выведи по манифесту'}. Падение установки первопричиной бага не называй.` : prep['prepare-status'] === 'skipped' ? ` Каталог подготовлен прошлым прогоном, подготовка не повторялась: сборка упала на зависимостях - выполни ${prep.prepare_cmd || 'подготовку по манифесту'} сам, падение установки первопричиной бага не называй.` : ''}${baselineNote(treeBase)}`

phase('Reproduce')
// Воспроизведение и первопричина - установленный факт прошлого прогона: при возобновлении правка
// уже наложена, и повторный прогон диагноста не столько дорог, сколько нечестен - симптома он
// может уже не увидеть. Нет записи в ledger - узел отрабатывает как в первом прогоне.
const diagPrompt = (dispute) => `${HEAD}${DONE}${DONE ? `Шаг 1 выполняется заново: ${dispute ? 'прошлый диагноз оспорен, улика ниже' : 'диагноза с причиной в ledger нет'}.\n` : ''}Шаг 1 (воспроизведение): первопричина. Источник: ${A.source || 'формулировка выше'}. Стек: ${prep.stack}. Тесты: ${prep.test_cmd || 'нет'}. Сборка: ${prep.build_cmd || 'нет'}.${treeState} Воспроизведи: красный тест через продуктовый путь, прогнанный и падающий по причине симптома, либо, если тест не ставится, прослеженный путь от входа до места сбоя. ${A.source ? `Критерии приёмки корпуса против ожидаемого во входе и критерия «готово» суди вызовом Skill dex-skill-requirement-quality:requirement-quality, раздел «Противоречие»; найденное - в conflicts. ${ownerSide}` : `Источника требований нет: conflict-status: none, conflicts пустой.`} Расхождение о техконтексте (файлы, команды сборки и тестов, корпус) сюда не подпадает: техконтекст берётся из дерева. Продуктовый код не меняй; написанный тест оставь незакоммиченным в дереве. Незакоммиченный тест в дереве до твоего старта - след прошлого диагноза этой цели: падает по причине симптома - он и есть воспроизведение, иначе удали; сдаёшь один тест.${dispute ? `\nКодер оспорил твой диагноз ${ledgerRepro && ledgerRepro.accepted ? `после приёмки (diagnosis-check: ${ledgerRepro.accepted}): его правки по диагнозу - в коммитах ветки, улика судится на дереве с ними` : 'до правки'}, улика: ${dispute}\nУлика - первая запись falsification: held - чем отбита, файл:строка; refuted - новый диагноз.` : ''}`
const diag = reproResumed || await own('диагност первопричины', diagPrompt(priorDispute), { label: 'reproduce', phase: 'Reproduce', schema: REPRO }, NODE.debugger)
trail.push({ step: '1-repro', doer: reproResumed ? 'ledger (воспроизведение прошлого прогона)' : NODE.debugger.agentType, status: diag ? diag.status : 'null' })
// accepted - факт приёмки кодером, accepted_blob - ожидаемый хэш теста после неё, accepted_pending - снимок ещё не снят: живут в repro, чтобы пережить ledger;
// новый диагноз их сбрасывает.
const withCtx = (d) => ({ repro_test: '', ...d, repro_blob: d.repro_test ? String(d.repro_blob || '').trim() : '', dispute: '', accepted: d.accepted || '', accepted_blob: d.repro_test ? String(d.accepted_blob || '').trim() : '', accepted_pending: !!d.accepted_pending, stack: prep.stack, build_cmd: prep.build_cmd, test_cmd: prep.test_cmd, report_cmd: prep.report_cmd || '', prepare_cmd: prep.prepare_cmd })
// Диагноз без причины на возобновлении: ledger отдаёт его непригодным, и следующий прогон зовёт диагноста заново.
const RESET = { root_cause: '', files: [] }
const testLeft = (d) => d && d.repro_test ? `; тест диагноста оставлен в дереве: ${d.repro_test}` : ''
// Выбор стороны в противоречии источников - полномочие владельца требований, не узла: починка под
// выбранную сторону закрепляется тестом, и решение в пользу второй стоит его инверсии (зонд P23).
// Перечень судится наравне со статусом: «none» при непустом перечне сам себя опровергает.
// Перечень из ledger схемой не проверен: repro формы до #255 его не несёт, и форма R2 от этого не перестаёт быть законной.
const listOf = (d) => Array.isArray(d.conflicts) ? d.conflicts : []
const conflictsOf = (d) => d['conflict-status'] === 'some' || listOf(d).length ? `противоречие источников ожидаемого, выбор стороны не за исполнителем: ${listOf(d).join('; ') || 'перечень не назван при conflict-status: some'}` : ''
// Правящему идёт только диагноз с установленной причиной (diagnosis-acceptance.md, «Вызывающий»).
const noCause = (d, where) => outcome('partial', where, (d.missing || 'диагност не назвал, чего не хватило') + testLeft(d), { repro: { ...withCtx(d), ...(priorDispute ? { dispute: ledgerRepro.dispute, accepted: ledgerRepro.accepted || '', accepted_blob: ledgerRepro.accepted_blob || '', accepted_pending: !!ledgerRepro.accepted_pending } : {}) }, disputes, decisions: dec() })
if (!diag || diag.status === 'blocked') return bail('Reproduce', lack(diag, 'диагност') + testLeft(diag))
// Противоречие проверяется до причины: без причины оно осталось бы и в следующем прогоне.
// Воспроизведение этот исход не переживает (repro - форма сброса RESET): решение владельца меняет источник ожидаемого,
// и поданное из ledger оно встало бы на том же противоречии по уже исправленным документам. Пустой Контекст
// прошлую запись ledger не перекрывает - сброс идёт формой без причины.
if (conflictsOf(diag)) return bail('Reproduce', conflictsOf(diag) + testLeft(diag), { repro: RESET })
if (!diag.root_cause) return noCause(diag, 'Reproduce: причина не установлена')
repro = withCtx(diag)
if (!repro.repro_test && String(diag.repro_blob || '').trim()) degraded.push(`снимок теста диагноста ${String(diag.repro_blob).trim()} без пути (repro_test пуст): правка и удаление теста не сверяются`)
if (repro.repro_test && !repro.repro_blob) degraded.push(`тест диагноста ${repro.repro_test} назван без снимка (repro_blob пуст): правка теста хэшем не сверяется, удаление сверяется`)
const causeOf = (d) => `Первопричина: ${d.root_cause}\nВоспроизведение: ${d.reproduction}\nОснование ожидаемого: ${d['expected-basis']}\nРешение исправления: ${d.fix_proposal}${d.repro_test ? `\nТест диагноста: ${d.repro_test}` : ''}`
const causeText = causeOf(repro)
// Правка теста диагноста ловится хэшем, а не отчётом кодера: проверку, подогнанную под свой фикс, отчёт не назовёт.
// Сигнал ревьюеру идёт против теста диагноста и на каждом круге заново: замороженный до фазы Review, он молчал бы о подмене в правке по находкам.
const touchedOrig = (v) => !!repro.repro_blob && !!v && hashOf(v) !== repro.repro_blob
// Приёмка одна на диагноз: исход первой попытки - факт, поздний harness-fixed гейт не открывает. Первый исход
// держится отдельно от записи приёмки: n/a при тесте приёмкой не записывается, но первым исходом остаётся.
let firstCheck = repro.accepted
const noteCheck = (f) => {
  const dc = f && f['diagnosis-check'] || ''
  const first = !firstCheck && !!dc
  if (first) firstCheck = dc
  // n/a - исход «теста в диагнозе нет»: при тесте в диагнозе приёмкой он не считается.
  if (!repro.accepted && dc && !/^disputed-/.test(dc) && !(dc === 'n/a' && repro.repro_test)) { repro.accepted = dc; repro.accepted_pending = first && dc === 'harness-fixed' }
  return dc
}
// Хэш - шестнадцатеричная строка; любой иной ответ верификатора (пусто, missing, текст ошибки git) - файла нет.
const hashOf = (v) => String(v && v.repro_test_hash || '').trim()
const testMissing = (v) => !!repro.repro_test && !/^[0-9a-f]+$/i.test(hashOf(v))
// Гейт судит против ожидания: снимок диагноста, а после harness-fixed первым исходом - хэш верификации этого круга.
// Сдвигает ожидание только круг приёмки; оборванный до верификации он ждёт её в repro и на возобновлении (I4).
const settle = (v) => { if (repro.accepted_pending && !noRun(v)) { if (!testMissing(v)) repro.accepted_blob = hashOf(v); repro.accepted_pending = false } }
const expected = () => repro.accepted_blob || repro.repro_blob
// Попытка после приёмки идёт по изменённому дереву: повторная приёмка дала бы ложный спор о позеленевшем тесте.
// Снимок идёт вместе с исходом: сверку перед коммитом исполнитель без него не проведёт. Теста диагноста нет - проба своя.
const acceptance = () => repro.accepted
  ? `Диагноз принят прошлой попыткой (diagnosis-check: ${repro.accepted}): приёмку не повторяй, diagnosis-check - ${repro.accepted}; ${repro.repro_test ? `правке нужна другая проверка - тест диагноста не трогай, diagnosis-check - disputed-* с уликой в dispute${expected() ? `; снимок приёмки - ${expected()}, сверяй с ним перед коммитом` : ''}` : 'теста диагноста нет - проба твоя, правь её по red-run'}.`
  : 'До правки прими диагноз: исход - diagnosis-check, улика спора - dispute.'
// Спор с диагнозом до и после приёмки идёт одним путём: «продолжить» зовёт диагноста с уликой; ожидаемое - за владельцем требований.
const disputeExit = (dc, f, where, extra) => {
  const clue = f.dispute || 'улика не названа'
  if (dc === 'disputed-expected') return bail(`${where}: спор об ожидаемом`, `кодер оспорил ожидаемое, выбор стороны за владельцем требований: ${clue}${testLeft(repro)}`, { disputes, repro: RESET, ...extra })
  return outcome('partial', `${where}: кодер оспорил диагноз (${dc})`, `решение оператора: «продолжить» вернёт диагноз диагносту с уликой - ${clue}${testLeft(repro)}`, { disputes, repro: { ...repro, dispute: clue }, fix, decisions: dec(), ...extra })
}

phase('Fix')
// -w: хэш прогона может стать снимком приёмки, а git show и git diff читают лишь записанный объект.
const verifyText = (snap, from = '') => A.scripts ? `${snap ? ' и не коммитить' : ''}. ${verifyRun(A.scripts, verifySpec(repro, known, { hash_path: repro.repro_test || '', ...(from ? { delta_from: from } : {}), ...(snap ? { snap: { blob: snap, path: repro.repro_test } } : {}) }))}`
  : `${snap ? ` и не коммитить. Сначала git show ${snap} > ${repro.repro_test}, git hash-object ${repro.repro_test} - в snap_hash` : ''}. Выполни ${repro.build_cmd ? `сборку: ${repro.build_cmd}; ` : ''}${repro.test_cmd ? `тесты: ${repro.test_cmd}` : 'тестов нет - build_ok по сборке, счётчики 0'}; затем ${snap ? `git checkout -- ${repro.repro_test} при любом исходе, blocked тоже, после него ` : ''}${VERIFY_CMDS}${repro.repro_test ? `; git hash-object -w ${repro.repro_test} - в repro_test_hash` : '; repro_test_hash пустой'}. Числа - из вывода раннера как есть.`
// Фаза параметром: verify зовётся и из Review, а фаза берётся из opts, не из phase().
const verifyOnce = (tag, ph = 'Fix') => verifyNode(HEAD, tag, ph, BVERIFY, verifyText(''))
// Зелёная верификация на цели без прошлого прогона значит «работа не покрыта тестами», а не «сделана»: молча пропустить правку по ней нельзя.
if (A.resume && !resuming) {
  log('«продолжить» без следа прошлого прогона в ledger: трек идёт как первый, фаза правки не пропускается')
  decisions.push('«продолжить» подано без trail: прогона по этой цели в ledger нет, возобновление не применено - трек отработал как первый')
}
// Возобновление начинается с верификации: зелёное дерево с коммитами трека не переделывается, прежние находки несёт ревью (P115).
// Кодер, вызываемый при любом исходе верификации, гоняет тесты сам; снимок приёмки (I4) ждёт именно её (T7a).
const coderAnyway = resuming && !reproResumed && !repro.accepted_pending
if (coderAnyway) trail.push({ step: 'resume', doer: 'не куплено: кодер вызывается при любом исходе', status: 'skipped' })
else if (resuming) {
  ver = await verifyOnce('возобновление')
  trail.push({ step: 'resume', doer: 'general-purpose', passed: passed(ver) })
  if (noRun(ver)) return bail('Fix: верификация при возобновлении', lack(ver, 'верификатор'))
  settle(ver)
}
// Диагноз этого прогона ещё никто не правил; без коммитов трека прошлый прогон встал до правки, и зелёные базовые тесты работу не подтверждают.
const ahead = !!(ver && ver.ahead)
let pending = coderAnyway || (resuming && !reproResumed) || (!ahead && (ASK.length > 0 || resuming)) || !!priorMissing
for (let k = 1; k <= FIX_CEILING && (!passed(ver) || pending); k++) {
  loops.fix = k; pending = false
  // red-run прошлой попытки - установленный факт: без него следующая попытка показывает тот же тест красным заново, проедая потолок.
  const shown = (fix && fix['red-run'] || []).filter(r => r.status === 'shown')
  const priorRed = shown.length ? `\nКрасный прогон уже показан прошлой попыткой и перепроверке не подлежит: ${redLines(shown)}` : ''
  const prev = ver && !passed(ver) ? `\n${k === 1 ? 'Верификация при возобновлении' : `Попытка ${k - 1}`} не прошла: ${redNote(ver, known)}.${priorRed}` : ''
  fix = await own('кодер', `${HEAD}${DONE}${OPEN}Шаг 2, попытка ${k} из ${FIX_CEILING}: лечи первопричину, не симптом; один баг - один фикс, попутного рефакторинга нет.\n${causeText}\nФайлы: ${repro.files.join(', ')}. Тесты: ${repro.test_cmd || 'нет'}. Сборка: ${repro.build_cmd || 'нет'}. ${COVER_ONLY}${treeState}${prev}\n${acceptance()} Red-run: тест диагноста - твоя проба, в коммит; теста нет - пишешь свой. По завершении: коммит локально (сообщение по симптому).`,
    { label: `fix:${k}`, phase: 'Fix', schema: BFIX }, NODE.coder)
  trail.push({ step: 2, attempt: k, doer: NODE.coder.agentType, status: fix ? fix.status : 'null', 'red-run': fix ? fix['red-run'] : null, 'diagnosis-check': fix ? fix['diagnosis-check'] : null })
  if (fix) decisions.push(...said(fix))
  // Спор идёт раньше статуса: при нём кодер отдаёт partial без правки.
  const dc = noteCheck(fix)
  if (/^disputed-/.test(dc)) {
    disputes.push(`${dc} (попытка ${k}): ${fix.dispute || 'улика не названа'}`)
    return disputeExit(dc, fix, `Fix#${k}`)
  }
  if (!fix || fix.status === 'blocked') return bail(`Fix#${k}`, lack(fix, 'узел-кодер'))
  cmds0 = cmds0 || cmdsOf(repro)
  repro = withCommands(repro, fix)
  ver = await verifyOnce(`после попытки ${k}`)
  settle(ver)
  trail.push({ step: '2-exit', attempt: k, doer: 'general-purpose', passed: passed(ver) })
  if (noRun(ver)) return bail(`Fix#${k}: верификация`, lack(ver, 'верификатор'))
  if (!passed(ver)) log(`попытка ${k}: exit=${ver && ver.exit_code}, build_ok=${ver && ver.build_ok}, fail=${ver && ver.fail_count}, dirty=${ver && ver.dirty}`)
}
if (!passed(ver)) return outcome('partial', `Fix: потолок ${FIX_CEILING} исчерпан`, `дерево не зелёное после ${FIX_CEILING} попыток: ${redNote(ver, known)}`, { ver, repro, fix, decisions: dec() })
phase('Review')
// Диагноз этого прогона - другое намерение: коммиты до прежней базы судились против опровергнутой причины.
const firstBase = priorBase(reproResumed ? A.trail : null)
const review = (tag, f, v, priors, base, h, gaps = '') => own('саморевьюер', `${HEAD}Шаг 3 (${tag}): pre-push саморевью локальной ветки - ${scope(base)}${hunkList(spotsOf(h))}${conventionsText(h)}${gapAsk(gaps)}${swapText(cmds0, repro)}${touchedOrig(v) ? `\nТест диагноста ${repro.repro_test} изменён кодером: исходник - git show ${repro.repro_blob}. Изменена проверка - вход, вызываемый путь или ожидаемое - находка P1.` : ''}${coderInput(f)} Источник намерения:\n${causeText}${priors.length ? `\n${LISTED}\n${priors.map(listedLine).join('\n')}` : ''}${RESUMED}\nПрогон build/test реальный, итог - в run-status, не в findings. Код не меняй.`,
  { label: `self-review:${tag}`, phase: 'Review', schema: { type: 'object', properties: { ...REVIEW.properties, 'conventions-read': conventionsRead(h) }, required: [...REVIEW.required] } }, NODE.reviewer)
// Спор с диагнозом в правке по находкам - тот же выход, что в попытке Fix.
const disputed = (f, k, open) => {
  const dc = noteCheck(f)
  if (!/^disputed-/.test(dc)) return null
  trail.push({ step: '2-after-review', attempt: k, doer: NODE.coder.agentType, status: f.status, 'diagnosis-check': dc })
  disputes.push(`${dc} (правка по находкам ${k}): ${f.dispute || 'улика не названа'}`)
  return disputeExit(dc, f, 'Review: правка по находкам', { fix_after_review: f, ...open })
}
const loop = await reviewLoop({ fix, ver, firstBase, review, coder: async (p) => { const f = await own('кодер', p, { label: 'fix:after-review', phase: 'Review', schema: BFIX }, NODE.coder); cmds0 = cmds0 || cmdsOf(repro); repro = withCommands(repro, f); return f }, intent: () => `${causeText}\n${acceptance()}`,
  verify: (tag, from) => verifyNode(HEAD, tag, 'Review', BVERIFY, verifyText('', from)), afterCoder: disputed, afterVerify: settle, moved: (a, b) => hashOf(a) !== hashOf(b),
  run: () => `Тесты: ${repro.test_cmd || 'нет'}. Сборка: ${repro.build_cmd || 'нет'}. ${COVER_ONLY}`, red: (v) => redNote(v, known) })
if (loop.exit) return loop.exit
const { rev, fal, reg, spots, dropped } = loop
fix2 = loop.fix2; ver2 = loop.ver2
const finalVer = ver2 || ver
const green = passed(finalVer)
if (green && inheritedFails(finalVer, known).length) degraded.push(`падения базы не исправлены и правке не вменены: ${inheritedFails(finalVer, known).join('; ')}`)
// Снимок - когда исход не решили кодер, ревью, находки порога; его blocked - стоп, как у верификатора круга.
const wantSnap = !admit(green, rev, reg.holding(), '') && !coderGap(fix, fix2, loop.offeredOnly) && !!repro.test_cmd && !testMissing(finalVer) && !!expected() && hashOf(finalVer) !== expected()
const snap = wantSnap ? await verifyNode(HEAD, 'снимок', 'Review', BSNAP, verifyText(expected())) : null
const placed = !!snap && String(snap.snap_hash || '').trim() === expected()
const back = !!snap && !snap.dirty && hashOf(snap) === hashOf(finalVer) && snap.ahead === finalVer.ahead
const sha = shaOf(finalVer)
// --soft: коммит верификатора, если он был, уходит в индекс и виден в git status, а не теряется.
const restore = (A.cwd ? `cd ${A.cwd} && ` : '') + (sha ? `git reset --soft ${sha} && git checkout ${sha} -- ${repro.repro_test}` : `git show ${hashOf(finalVer)} > ${repro.repro_test}`)
if (wantSnap) trail.push({ step: 'snapshot', doer: 'general-purpose', status: snap ? snap.status : 'null', placed, passed: passed(snap), returned: back })
if (wantSnap && noRun(snap)) return bail('Review: прогон снимка', `${lack(snap, 'верификатор')}; ${repro.repro_test} мог остаться снимком, вернуть: ${restore}`, { fix_after_review: fix2, review: rev, prior: reg.all(), decisions: [...dec(), ...askLines(reg)] })
const snapNote = !repro.test_cmd ? '; снимок не прогнан: команды тестов нет' : !wantSnap ? ''
  : (!placed ? `; снимок ${expected()} не поставлен: snap_hash ${snap.snap_hash || 'пусто'}` : !passed(snap) ? `; снимок ${expected()} на итоговом коде не зелёный: ${redNote(snap, known)}` : '')
    + (!back ? `; файл теста после прогона снимка ${expected()} не возвращён: repro_test_hash ${hashOf(snap) || 'пусто'} при итоговом ${hashOf(finalVer)}, ahead ${snap.ahead} при итоговом ${finalVer.ahead}, dirty=${snap.dirty}, вернуть: ${restore}` : '')
// Удалённый тест - разрыв при любой приёмке и без снимка: путь верификатору назван треком. Правка теста - против ожидания,
// а не вердикта: суждение «обвязка или проверка» ревью несёт на круге приёмки, дальше тест держится снимком.
// Тест в диагнозе, а правка прошла без записанной приёмки (n/a при тесте) - тоже разрыв.
const testGap = testMissing(finalVer) ? `тест диагноста ${repro.repro_test} удалён (repro_test_hash: ${hashOf(finalVer) || 'пусто'})`
  : !!expected() && hashOf(finalVer) !== expected() && !(placed && back && passed(snap)) ? `тест диагноста ${repro.repro_test} изменён при diagnosis-check: ${((fix2 || fix) || {})['diagnosis-check'] || repro.accepted || 'не назван'}${snapNote}`
  : fix && repro.repro_test && !repro.accepted ? `приёмка диагноза не проведена: diagnosis-check ${(fix2 || fix)['diagnosis-check'] || 'не назван'} при тесте диагноста ${repro.repro_test}` : ''
const gap = [ledgerUnread ? LEDGER_UNREAD : '', coderGap(fix, fix2, loop.offeredOnly) || testGap || (repro.status === 'partial' ? `воспроизведение partial: ${repro.missing || `эталон - ${repro['expected-basis']}`}` : ''),
  !repro.build_cmd && !repro.test_cmd ? 'внешнего факта нет: ни сборки, ни тестов' : '', !finalVer.ahead ? 'коммитов трека нет' : '', reviewGap(rev, reg.all()), spotGap(rev, spots), falsifyGap(rev, fal)].filter(Boolean).join('; ')
const where = admit(green, rev, reg.holding(), gap)
return outcome(where ? 'partial' : 'complete', where, where, {
  goal_check: { build_ok: finalVer.build_ok, tests_green: finalVer.exit_code === 0 && finalVer.fail_count === 0, inherited: inheritedFails(finalVer, known), committed: !finalVer.dirty && finalVer.ahead > 0, head: finalVer.head },
  repro, fix, fix_after_review: fix2, review: rev, falsify: fal, prior: reg.all(), dropped, disputes,
  decisions: [...dec(), ...askLines(reg)],
})
