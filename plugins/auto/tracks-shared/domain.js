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
