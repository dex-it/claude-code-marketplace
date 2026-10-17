// Трек ревью чужого MR/PR как Workflow-скрипт (artifacts.md, O12 вариант A). Read-only: код не правится.
// Вход через args: { task, mr, intent, mode, publish, last_review_sha, cwd, open_findings }.
// Публикация тредов - outward-facing: только при publish=true (флаг --post команды), иначе перечень в возврате.
export const meta = {
  name: 'dex-auto-review',
  description: 'Трек ревью MR/PR: контекст -> ревью -> фальсификация и покрытие -> публикация по санкции',
  phases: [
    { title: 'Context', detail: 'предмет ревью: SHA, объём diff, источник намерения; рабочий каталог на head_sha' },
    { title: 'Review', detail: 'dex-auto:reviewer - первичное ревью либо ревизия дельты' },
    { title: 'Falsify', detail: 'каждая находка и статус прежней - claim: сверка с кодом ветки, вердикт по покрытию и итоговый вердикт' },
    { title: 'Publish', detail: 'инлайн-треды при publish=true; иначе перечень к публикации' },
  ],
}

const A = args || {}
const DELTA = !!A.last_review_sha
const HEAD = `mode: ${A.mode || 'autonomous'}\nцель (${A.task}): ревью ${A.mr}${DELTA ? ` - ревизия дельты от ${A.last_review_sha}` : ''}.\nread-only: код не менять, тесты не писать, в MR ничего не публиковать - публикует отдельный узел по санкции.\nРабочий каталог - ${A.cwd}, процесс уже в нём. Веток не создавай, код не меняй, коммитов не делай. Оператора нет: невыводимое верни status: blocked с полем нехватки; неясность намерения по diff - вопрос автору в перечне, не оператору.\n`

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
const CTX = { type: 'object', properties: {
  status: STATUS, platform: { type: 'string', enum: ['github', 'gitlab', 'other'] },
  base_sha: { type: 'string' }, head_sha: { type: 'string' }, files: { type: 'array', items: { type: 'string' } },
  hunks: { type: 'array', items: { type: 'string' }, description: 'путь от корня репозитория без a/ и b/, место file:from-to по +start,count заголовка @@ (from = start, to = start+count-1); только удалённые строки (count 0) - file:start; удалённый файл - file' },
  at_head: { type: 'boolean' },
  intent: { type: 'string', description: 'источник намерения с адресом либо "n/a: <где искали>"' },
  conventions: CONVENTIONS.conventions, 'conventions-searched': CONVENTIONS['conventions-searched'],
  missing: { type: 'string' },
}, required: ['status', 'platform', 'base_sha', 'head_sha', 'files', 'hunks', 'at_head', 'intent', 'conventions', 'conventions-searched', 'missing'] }
const THREAD = { type: 'object', properties: { anchor: PRIOR.properties.anchor, severity: SEV, axis: PRIOR.properties.axis, text: PRIOR.properties.text, status: PRIOR.properties.status, evidence: PRIOR.properties.evidence }, required: ['anchor', 'severity', 'axis', 'text', 'status', 'evidence'] }
const REVIEW = { type: 'object', properties: {
  status: STATUS, findings: { type: 'array', items: FINDING, description: 'только находки, которых нет среди прежних' },
  'fact-check': FACT_CHECK('техутверждения находок о стороннем API'),
  'conventions-read': CONVENTIONS_READ,
  axes: AXES,
  roots: ROOTS,
  'review-verdict': VERDICT,
  prior: { type: 'array', items: PRIOR, description: 'по каждой находке перечня ledger - запись с её id, статус с доказательством; перечня нет - пусто' },
  threads: { type: 'array', items: THREAD, description: 'ре-ревью дельты: прежние находки тредов MR, которых нет в перечне ledger, - статус с доказательством; иначе пусто' },
  questions: { type: 'array', items: { type: 'string' }, description: 'вопросы автору по намерению' },
  missing: { type: 'string' },
}, required: ['status', 'findings', 'fact-check', 'conventions-read', 'axes', 'roots', 'review-verdict', 'prior', 'threads', 'questions', 'missing'] }

const loops = { review: 0, falsify: 0 }
const trail = [], degraded = []
const unfedArgs = unfed(A, ['task', 'cwd', 'mr'])
if (unfedArgs.length) return outcome('blocked', 'Context', `трек вызван без входа: нет ${unfedArgs.join(', ')}`)
const LEDGER = ledgerList(A.open_findings, 'прежние находки этим прогоном не сверены')
const fmt = (fs) => fs.map(findingLine).join('\n')

phase('Context')
const ctx = await node('сбор предмета ревью', `${HEAD}Шаг 1: предмет ревью. Канал хостинга - MCP платформы через ToolSearch, иначе gh/glab. Возьми метаданные ${A.mr}: base/head SHA, список файлов diff, описание; hunks - места правки ${DELTA ? A.last_review_sha : 'base SHA'}..head SHA по заголовкам @@ git diff -U0 на стороне правки, без файлов тестов. Получи head SHA (git fetch ссылки MR) и сверь с ним HEAD рабочего каталога (git rev-parse HEAD) и проверь git status --porcelain; каталог не переключай; at_head - HEAD совпал и вывод git status пуст; иначе status partial, причина в missing. Источник намерения: ${A.intent || 'не передан - возьми описание MR и связанный тикет; нет и их - "n/a" с перечнем, где искали'}. ${conventionsAsk} Код и MR не меняй.`,
  { label: 'ctx:subject', phase: 'Context', effort: 'low', schema: CTX })
trail.push({ step: 1, doer: 'general-purpose', status: ctx ? ctx.status : 'null' })
if (!ctx || ctx.status === 'blocked') return outcome('blocked', 'Context', lack(ctx, 'узел контекста'))

phase('Review')
// Где читать код правки, знают оба узла суждения: скептик, читающий диск не на head_sha, сбросил бы находки о правке.
const TREE_AT = `${ctx.at_head ? `Каталог ${A.cwd} на ${ctx.head_sha}, код читай с диска` : `Каталог ${A.cwd} не на ${ctx.head_sha} (${ctx.missing || 'причина не названа'}): код правки читай через канал хостинга на этой ревизии`}; ревизию не переключай - нужна другая, читай её через git show.`
const common = `MR/PR: ${A.mr}, BASE_SHA ${ctx.base_sha}, HEAD_SHA ${ctx.head_sha}, файлов ${ctx.files.length}. intent: ${ctx.intent}. publish: false - ноль записей в MR. ${TREE_AT}${conventionsText(ctx)}`
const LEDGER_TEXT = LEDGER.length ? `\nПрежние находки из ledger - по каждой запись в prior с её id, статус с доказательством; находка перечня идёт только в prior, в findings - то, чего в перечне нет:\n${LEDGER.map(priorLine).join('\n')}` : ''
const rev = await own(DELTA ? 'ре-ревьюер дельты' : 'ревьюер MR', `${HEAD}Шаг 2: ${DELTA ? `ре-ревью дельты: LAST_REVIEW_SHA ${A.last_review_sha}, статус прежних находок, новые находки только в дельте` : `первичное ревью правки ${ctx.base_sha}..${ctx.head_sha}`}. ${common}${DELTA ? ' Прежняя находка из тредов MR, которой нет в перечне ledger, - в threads, не в prior.' : ''}${hunkList(ctx.hunks)}${LEDGER_TEXT}`,
  { label: DELTA ? 'review:delta' : 'review:first', phase: 'Review', schema: { type: 'object', properties: { ...REVIEW.properties, 'conventions-read': conventionsRead(ctx) }, required: [...REVIEW.required] } }, NODE.reviewer)
loops.review = 1
trail.push({ step: 2, doer: NODE.reviewer.agentType, status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1 })
if (!rev || rev.status === 'blocked') return outcome('blocked', 'Review', lack(rev, 'узел ревью'), { ctx })
const claims = rev.findings
const axes = rev.axes || []
// Статус прежней у ревьюера - claim: выносит его скептик, а прежняя, о которой он промолчал, остаётся непроверенной.
const reg = registry('статус скептиком не сверен')
LEDGER.forEach(reg.doubt)
const claimOf = {}
for (const p of rev.prior) {
  if (LEDGER.some(l => l.id === p.id)) claimOf[p.id] = p
  else degraded.push(`ревьюер: запись prior ${p.id || 'без id'} (${p.anchor}) не из перечня ledger - статус не принят`)
}
for (const { f, id } of reg.take(rev.threads, 'ревьюер: треды MR')) { const k = id || reg.doubt(f); claimOf[k] = claimOf[k] || f }
const priorIn = reg.all().map(p => ({ ...p, claim: claimOf[p.id] }))

phase('Falsify')
loops.falsify = 1
const fal = await own('скептик', `${HEAD}Шаг 3: фальсификация находок, исходов осей и решений ревьюера, вердикт по покрытию. ${common}\nНаходки:\n${fmt(claims) || '- находок нет: только вердикт по покрытию'}${priorIn.length ? `\nПрежние находки - статус ре-ревьюера:\n${priorIn.map(p => `${priorLine(p)} - ре-ревьюер: ${p.claim ? `${p.claim.status} - ${p.claim.evidence}` : 'статус не назван'}`).join('\n')}` : ''}\nОси ревьюера:\n${axesText(axes)}\nРешения ревьюера:\n${rootsText(rev.roots)}${rev.questions.length ? `\nВопросы автору от ревьюера:\n${rev.questions.map(q => `- ${q}`).join('\n')}` : ''}`,
  { label: 'falsify+coverage', phase: 'Falsify', schema: FALSIFY }, NODE.skeptic)
trail.push({ step: 3, doer: NODE.skeptic.agentType, status: fal ? fal.status : 'null', confirmed: fal ? fal.confirmed.length : -1, dropped: fal ? fal.dropped.length : -1 })
if (!fal || fal.status === 'blocked') return outcome('blocked', 'Falsify', lack(fal, 'скептик'), { ctx, review: rev, claims, prior: reg.all() })
reg.apply(fal, 'скептик')
const confirmed = []
for (const { f, id } of reg.take(fal.confirmed, 'скептик', undefined, shutBy(fal))) if (id) reg.seat({ ...f, id }, 'open', f.evidence); else confirmed.push({ ...f, id: reg.mint() })
const prior = reg.all()
const unsettled = prior.filter(p => p.status === 'unverified')

phase('Publish')
let pub = null
if (A.publish && confirmed.length) {
  // Исход публикации называет находку её id из перечня: на одном якоре и оси бывают две находки, и место одну от другой не отличает.
  const ids = { type: 'string', enum: confirmed.map(f => f.id) }
  pub = await node('публикатор тредов', `${HEAD}Шаг 4: санкция publish=true получена от оператора. Опубликуй каждую находку инлайн-тредом в ${A.mr} по anchor через канал хостинга (MCP платформы через ToolSearch, иначе gh/glab); severity и критерий закрытия - в тексте треда. До публикации прочитай треды MR своего аккаунта: на том же anchor уже есть тред по этой находке - не публикуй, в published с url существующего и note «уже был». Чужие треды не трогать, approve/request changes не ставить. Отказ канала - тред в unpublished с причиной, находку не терять. Исход каждой находки - запись с её id из перечня.\n${fmt(confirmed)}`,
    { label: 'publish', phase: 'Publish', effort: 'low', schema: { type: 'object', properties: {
      status: STATUS,
      published: { type: 'array', items: { type: 'object', properties: { id: ids, url: { type: 'string' }, note: { type: 'string', description: '"уже был" - тред существовал до прогона; иначе пусто' } }, required: ['id', 'url', 'note'] } },
      unpublished: { type: 'array', items: { type: 'object', properties: { id: ids, reason: { type: 'string' } }, required: ['id', 'reason'] } },
    }, required: ['status', 'published', 'unpublished'] } })
  trail.push({ step: 4, doer: 'general-purpose', status: pub ? pub.status : 'null', published: pub ? pub.published.length : -1 })
}
// Находка без исхода публикатора теряется молча: каждая подтверждённая либо опубликована, либо названа неопубликованной.
const byId = (t) => confirmed.find(f => f.id === t.id)
if (pub) for (const t of [...pub.published, ...pub.unpublished]) if (!byId(t)) degraded.push(`публикатор: исход по id ${t.id || 'без id'} не из перечня - не засчитан`)
const told = pub ? [...pub.published, ...pub.unpublished].filter(byId).map(t => t.id) : []
const tag = (f, rest) => ({ id: f.id, anchor: f.anchor, axis: f.axis, ...rest })
const published = pub ? pub.published.filter(byId).map(t => tag(byId(t), { url: t.url, note: t.note })) : []
const unpublished = !pub ? confirmed.map(f => tag(f, { reason: A.publish ? 'узел публикации не вернул выход - находки к публикации' : 'санкции publish нет - перечень к публикации' }))
  : [...pub.unpublished.filter(byId).map(t => tag(byId(t), { reason: t.reason })), ...confirmed.filter(f => !told.includes(f.id)).map(f => tag(f, { reason: `публикатор (${pub.status}): исход по находке не назван` }))]
const allPublished = !A.publish || !confirmed.length || (pub && pub.status === 'complete' && unpublished.length === 0)
const issues = []
if (ledgerUnread) issues.push(LEDGER_UNREAD)
if (ctx.status === 'partial') issues.push(`предмет ревью неполон: ${ctx.missing || 'узел не назвал нехватку'}`)
else if (!ctx.at_head) issues.push(`рабочий каталог не на head_sha: ${ctx.missing || 'причина не названа'}`)
if (rev.status !== 'complete') issues.push(`ревью не завершено: ${rev.missing || 'узел не назвал нехватку'}`)
if (axesGap(axes, rev.findings)) issues.push(`ревью: ${axesGap(axes, rev.findings)}`)
if (rootsGap(rev.roots, [...rev.findings, ...(rev.prior || []), ...(rev.threads || [])])) issues.push(`ревью: ${rootsGap(rev.roots, [...rev.findings, ...(rev.prior || []), ...(rev.threads || [])])}`)
if (hunkGap(ctx.hunks, rev.roots)) issues.push(`ревью: ${hunkGap(ctx.hunks, rev.roots)}`)
if (conventionsGap(ctx, rev)) issues.push(`ревью: ${conventionsGap(ctx, rev)}`)
if (fal.status !== 'complete') issues.push(`фальсификация не завершена: ${fal.missing || 'узел не назвал нехватку'}`)
if (checkGap(rev, fal)) issues.push(`фальсификация: ${checkGap(rev, fal)}`)
if (unsettled.length) issues.push(`статус прежних находок не сверен скептиком: ${unsettled.map(p => p.id).join(', ')}`)
if (!allPublished) issues.push('часть тредов не опубликована')
// Вердикт выносит скептик, но опровергнуть его открытыми находками может и трек: APPROVE при открытой P0/P1 себя опровергает (BR-AUTO-003).
const openBlocking = [...confirmed, ...prior.filter(isOpen)].filter(isBlocking)
if (fal['review-verdict'] === 'APPROVE' && openBlocking.length) issues.push(`review-verdict APPROVE при открытых P0/P1: ${openBlocking.map(f => f.id).join(', ')}`)
const where = issues.join('; ')
return outcome(where ? 'partial' : 'complete', where, where, {
  subject: { mr: A.mr, base_sha: ctx.base_sha, head_sha: ctx.head_sha, files: ctx.files.length, platform: ctx.platform },
  intent: ctx.intent, 'review-verdict': fal['review-verdict'], reviewer_verdict: rev['review-verdict'], axes, roots: rev.roots || [], 'fact-check': rev['fact-check'], prior, questions: rev.questions,
  confirmed, dropped: fal.dropped, coverage: fal.coverage, 'axes-check': fal['axes-check'], 'roots-check': fal['roots-check'], 'roots-missed': fal['roots-missed'],
  published,
  unpublished,
})
