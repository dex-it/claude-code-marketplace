const STATUS = { type: 'string', enum: ['complete', 'blocked', 'partial'] }
const SEV = { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'], description: 'уровень словаря node-contract: P0 = CRITICAL, P1 = HIGH, P2 = MEDIUM, P3 = LOW' }
const AXIS = { type: 'string', enum: ['security', 'architecture', 'language', 'business', 'regressions', 'performance', 'coverage', 'loose-ends', 'non-code'] }
// Форма одна у всех ревьюеров: ledger хранит находку одной записью, и поле, которого нет у одного узла, из реестра выпадает молча.
const FINDING = { type: 'object', properties: {
  anchor: { type: 'string', description: 'file:line' }, severity: SEV, axis: AXIS,
  text: { type: 'string' }, closure: { type: 'string', description: 'критерий закрытия' }, evidence: { type: 'string' },
}, required: ['anchor', 'severity', 'axis', 'text', 'closure', 'evidence'] }
// Узел выносит статус из PRIOR_STATUS; unverified и dropped ставит только трек. Перечень реестра держат и dexauto.py с finish.py - сверяет sync-tracks --check.
const PRIOR_STATUS = ['closed', 'partial', 'open', 'disputed', 'no-longer-applicable']
const OPEN_FINDING = ['open', 'partial', 'unverified']
const FINDING_STATUS = [...OPEN_FINDING, 'closed', 'disputed', 'no-longer-applicable', 'dropped']
// Прежняя находка опознаётся по id реестра ledger: без него finish.sh заводит её новой, и разность «открытые» двоится.
const PRIOR = { type: 'object', properties: {
  id: { type: 'string', description: 'id из перечня прежних находок; находки в перечне нет - пусто' },
  anchor: FINDING.properties.anchor, severity: SEV, axis: { type: 'string', description: 'ось из перечня; не названа - пусто' }, text: { type: 'string' },
  status: { type: 'string', enum: PRIOR_STATUS }, evidence: { type: 'string' },
}, required: ['id', 'anchor', 'severity', 'axis', 'text', 'status', 'evidence'] }
// Ось различает находки одной строки, но запись ledger прошлых версий её не несёт: при оси у одной стороны сравнивается anchor.
const same = (a, b) => a.id && b.id ? a.id === b.id : a.anchor === b.anchor && (!a.axis || !b.axis || a.axis === b.axis)
const isOpen = (f) => OPEN_FINDING.includes(f.status)
const isBlocking = (f) => f.severity === 'P0' || f.severity === 'P1'
const priorLine = (p) => `- ${p.id ? `${p.id} ` : ''}[${p.severity}] ${p.axis ? `${p.axis} ` : ''}${p.anchor}: ${p.text}`
const findingLine = (f) => `${priorLine(f)} (закрытие: ${f.closure})\n  улика: ${f.evidence}`
// Статус прежней - последний, вынесенный узлом; о которой узел промолчал, та остаётся непроверенной, а не закрытой.
function registry(unsettled) {
  const list = []
  const seat = (p, status, evidence) => {
    const i = list.findIndex(q => same(q, p))
    const base = i < 0 ? { id: p.id || '', anchor: p.anchor || '', severity: p.severity || '', axis: p.axis || '', text: p.text || '' } : list[i]
    const rec = { ...base, status: FINDING_STATUS.includes(status) ? status : 'unverified', evidence: FINDING_STATUS.includes(status) ? evidence : `статус вне словаря реестра (${status}): ${evidence}` }
    if (i < 0) list.push(rec); else list[i] = rec
  }
  return {
    seat, all: () => list.slice(), open: () => list.filter(isOpen),
    blocking: () => list.filter(isOpen).filter(isBlocking),
    doubt: (p) => seat(p, 'unverified', unsettled),
    apply: (r) => { if (r && r.status !== 'blocked') for (const p of r.prior || []) seat(p, p.status, p.evidence) },
  }
}
// Не-complete без места и нехватки оператору не действенен, а finish.sh пишет цели пустую нехватку: инвариант держит конструктор, не каждый выход.
const outcome = (status, where, missing, extra) => status === 'complete'
  ? { status, where: '', missing: '', loops, trail, degraded, ...extra }
  : { status, where: where || 'место не названо', missing: missing || `${where || 'шаг не назван'}: нехватка не названа`, loops, trail, degraded, ...extra }
const lack = (v, who) => !v ? `${who} не вернул выход` : v.missing || `${who} вернул blocked без нехватки`
// Узел каталога может быть не установлен: тогда general-purpose с ролью в промпте, факт - в degraded (graceful degradation).
async function node(role, prompt, opts, type) {
  if (type) {
    try { const r = await agent(prompt, { ...opts, agentType: type }); return r }
    catch (e) {
      // Причина обрыва платформой не типизирована: узел мог не существовать, а мог упасть посреди работы. Замена получает причину и сверяет уже сделанное.
      const why = String(e && e.message || e).slice(0, 300)
      degraded.push(`${role}: ${type} не отработал (${why})`); log(`узел ${type} не отработал, general-purpose`)
      // Замена - не узел каталога: норм полей выхода у неё нет, а схема их больше не пересказывает.
      return agent(`Роль: ${role}.\nУзел ${type} на этом шаге оборвался ошибкой: ${why}. Прежде чем действовать, сверь git log и рабочее дерево: сделанное им не повторяй.\nНормы полей выхода (run-status, red-run, fact-check, uncovered, diff-scope, статусы ухода от проверки) у тебя не загружены: вызови Skill dex-skill-node-contract:node-contract до работы и заполняй по ним.\n${prompt}`, { ...opts, agentType: 'general-purpose' })
    }
  }
  return agent(`Роль: ${role}.\n${prompt}`, { ...opts, agentType: 'general-purpose' })
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
