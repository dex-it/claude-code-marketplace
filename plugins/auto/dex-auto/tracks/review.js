// Трек ревью чужого MR/PR как Workflow-скрипт (artifacts.md, O12 вариант A). Read-only: код не правится.
// Вход через args: { task, mr, intent, mode, publish, last_review_sha, cwd, open_findings }.
// Публикация тредов - outward-facing: только при publish=true (флаг --post команды), иначе перечень в возврате.
export const meta = {
  name: 'dex-auto-review',
  description: 'Трек ревью MR/PR: контекст -> ревью по осям (+ security по поверхности) -> фальсификация и покрытие -> публикация по санкции',
  phases: [
    { title: 'Context', detail: 'предмет ревью: SHA, объём diff, поверхность безопасности, источник намерения' },
    { title: 'Review', detail: 'mr-reviewer либо mr-check-reviewer на дельте; security-reviewer отдельным узлом' },
    { title: 'Falsify', detail: 'каждая находка и статус прежней - claim: сверка с кодом ветки, вердикт по покрытию и итоговый вердикт' },
    { title: 'Publish', detail: 'инлайн-треды при publish=true; иначе перечень к публикации' },
  ],
}

const A = args || {}
const DELTA = !!A.last_review_sha
const HEAD = `mode: ${A.mode || 'autonomous'}\nцель (${A.task}): ревью ${A.mr}${DELTA ? ` - ревизия дельты от ${A.last_review_sha}` : ''}.\nread-only: код не менять, тесты не писать, в MR ничего не публиковать - публикует отдельный узел по санкции.\nРаботай из ${A.cwd}: это отдельное detached git worktree трека - ревизии в нём переключай свободно, рабочего дерева сессии это не трогает. Запуск вне дерева отбивает хук: каждая команда Bash называет дерево и не называет каталог сессии, включая канал хостинга - git -C ${A.cwd} fetch <ссылка>, git -C ${A.cwd} checkout --detach <sha>, cd ${A.cwd} && gh pr diff <N>. Веток не создавай, код не меняй, коммитов не делай. Оператора нет: невыводимое верни status: blocked с полем нехватки; неясность намерения по diff - вопрос автору в перечне, не оператору.\n`

// >>> shared: domain
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
  id: { type: 'string', description: 'id находки из перечня; находки в перечне нет - её место в findings, не здесь' },
  anchor: FINDING.properties.anchor, severity: SEV, axis: { type: 'string', description: 'ось из перечня; не названа - пусто' }, text: { type: 'string' },
  status: { type: 'string', enum: PRIOR_STATUS }, evidence: { type: 'string' },
}, required: ['id', 'anchor', 'severity', 'axis', 'text', 'status', 'evidence'] }
const isOpen = (f) => OPEN_FINDING.includes(f.status)
const isBlocking = (f) => f.severity === 'P0' || f.severity === 'P1'
const priorLine = (p) => `- ${p.id ? `${p.id} ` : ''}[${p.severity}] ${p.axis ? `${p.axis} ` : ''}${p.anchor}: ${p.text}`
const findingLine = (f) => `${priorLine(f)} (закрытие: ${f.closure})\n  улика: ${f.evidence}`
// Опознание - по id (ledger.md R10): строка сдвигается правкой, а на одной строке бывают разные находки. Статус прежней - последний, вынесенный узлом; о которой узел промолчал, та остаётся непроверенной.
function registry(unsettled) {
  const list = []
  let minted = 0
  const at = (id) => id ? list.findIndex(q => q.id === id) : -1
  const seat = (p, status, evidence) => {
    const i = at(p.id)
    // Важность записи только растёт: повторное ревью, поднявшее P2 до P1, должно держать порог допуска.
    const base = i < 0 ? { id: p.id || `N${++minted}`, anchor: p.anchor || '', severity: p.severity || '', axis: p.axis || '', text: p.text || '', closure: p.closure || '' }
      : { ...list[i], severity: p.severity && (!list[i].severity || p.severity < list[i].severity) ? p.severity : list[i].severity }
    const rec = { ...base, status: FINDING_STATUS.includes(status) ? status : 'unverified', evidence: FINDING_STATUS.includes(status) ? evidence : `статус вне словаря реестра (${status}): ${evidence}` }
    if (i < 0) list.push(rec); else list[i] = rec
    return rec.id
  }
  // Страховка от промаха узла: молча склеивает только якорь с той же непустой осью, совпавший один якорь - на вид.
  const take = (fs, who, known = list.slice()) => {
    return (fs || []).map(f => {
      const hit = known.find(q => q.anchor === f.anchor && q.axis && q.axis === f.axis)
      if (hit) { degraded.push(`${who}: находка ${hit.id} (${f.anchor}) подана новой - узел не назвал id, опознана по якорю и оси`); return { f, id: hit.id } }
      const near = known.find(q => q.anchor === f.anchor)
      if (near) degraded.push(`${who}: находка ${f.anchor} (${f.axis || 'ось не названа'}) - возможный дубль ${near.id}, заведена отдельно`)
      return { f, id: '' }
    })
  }
  return {
    seat, take, all: () => list.slice(), open: () => list.filter(isOpen),
    blocking: () => list.filter(isOpen).filter(isBlocking),
    doubt: (p) => seat(p, 'unverified', !p.evidence || p.evidence === unsettled ? unsettled : p.evidence.startsWith(`${unsettled}; `) ? p.evidence : `${unsettled}; ${p.evidence}`),
    // Опознание - только в перечне, поданном узлу; статус из blocked-выхода не принимается, но его новые находки не теряются.
    apply: (r, who, listed = list.slice()) => {
      if (!r) return
      const blocked = r.status === 'blocked'
      if (!blocked) for (const p of r.prior || []) {
        if (!p.id || !listed.some(q => q.id === p.id)) degraded.push(`${who}: запись prior ${p.id || 'без id'} (${p.anchor}) не из перечня - статус не принят`)
        else seat(p, p.status, p.evidence)
      }
      for (const { f, id } of take(r.findings, who, listed)) if (!id) seat(f, 'open', f.evidence); else if (!blocked) seat({ ...f, id }, 'open', f.evidence)
    },
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
// <<< shared: domain
const CTX = { type: 'object', properties: {
  status: STATUS, platform: { type: 'string', enum: ['github', 'gitlab', 'other'] },
  base_sha: { type: 'string' }, head_sha: { type: 'string' }, files: { type: 'array', items: { type: 'string' } },
  security_surface: { type: 'boolean', description: 'diff трогает auth, внешний ввод, секреты, границу доверия, зависимости' },
  security_basis: { type: 'string', description: 'по чему судили о поверхности' },
  intent: { type: 'string', description: 'источник намерения с адресом либо "n/a: <где искали>"' },
  missing: { type: 'string' },
}, required: ['status', 'platform', 'base_sha', 'head_sha', 'files', 'security_surface', 'security_basis', 'intent', 'missing'] }
const THREAD = { type: 'object', properties: { anchor: PRIOR.properties.anchor, severity: SEV, axis: PRIOR.properties.axis, text: PRIOR.properties.text, status: PRIOR.properties.status, evidence: PRIOR.properties.evidence }, required: ['anchor', 'severity', 'axis', 'text', 'status', 'evidence'] }
const REVIEW = { type: 'object', properties: {
  status: STATUS, findings: { type: 'array', items: FINDING, description: 'только находки, которых нет среди прежних' },
  axes: { type: 'array', items: { type: 'string' }, description: 'исход каждой оси: "<ось>: находки N" | "<ось>: чисто, проверено <что>" | "<ось>: n/a - <чего в diff нет>"' },
  'review-verdict': { type: 'string', enum: ['APPROVE', 'REQUEST_CHANGES', 'NEEDS_DISCUSSION'] },
  prior: { type: 'array', items: PRIOR, description: 'по каждой находке перечня ledger - запись с её id, статус с доказательством; перечня нет - пусто' },
  threads: { type: 'array', items: THREAD, description: 'ре-ревью дельты: прежние находки тредов MR, которых нет в перечне ledger, - статус с доказательством; иначе пусто' },
  questions: { type: 'array', items: { type: 'string' }, description: 'вопросы автору по намерению' },
  missing: { type: 'string' },
}, required: ['status', 'findings', 'axes', 'review-verdict', 'prior', 'threads', 'questions', 'missing'] }
// review-verdict security-ревьюера трек не читает: итог выносит скептик по всем подтверждённым.
const SEC = { type: 'object', properties: {
  status: STATUS, findings: { type: 'array', items: FINDING }, axes: REVIEW.properties.axes,
  threat_model: { type: 'string', description: 'акторы x границы доверия x активы' }, missing: { type: 'string' },
}, required: ['status', 'findings', 'axes', 'threat_model', 'missing'] }
const FALSIFY = { type: 'object', properties: {
  status: STATUS,
  confirmed: { type: 'array', items: FINDING },
  dropped: { type: 'array', items: { type: 'object', properties: { anchor: { type: 'string' }, reason: { type: 'string' } }, required: ['anchor', 'reason'] } },
  coverage: { type: 'string', description: 'вердикт по покрытию изменённого поведения: непокрытые ветки поимённо либо "покрыто: <чем>"' },
  'review-verdict': { type: 'string', enum: ['APPROVE', 'REQUEST_CHANGES', 'NEEDS_DISCUSSION'], description: 'итоговый вердикт по confirmed (включая security) и по prior со статусом open или partial' },
  prior: { type: 'array', items: PRIOR, description: 'сверенный с кодом статус каждой прежней находки перечня; прежних нет - пусто' },
  missing: { type: 'string' },
}, required: ['status', 'confirmed', 'dropped', 'coverage', 'review-verdict', 'prior', 'missing'] }
const PUBLISH = { type: 'object', properties: {
  status: STATUS,
  published: { type: 'array', items: { type: 'object', properties: { anchor: { type: 'string' }, axis: { type: 'string' }, url: { type: 'string' }, note: { type: 'string', description: '"уже был" - тред существовал до прогона; иначе пусто' } }, required: ['anchor', 'axis', 'url', 'note'] } },
  unpublished: { type: 'array', items: { type: 'object', properties: { anchor: { type: 'string' }, axis: { type: 'string' }, reason: { type: 'string' } }, required: ['anchor', 'axis', 'reason'] } },
}, required: ['status', 'published', 'unpublished'] }

const loops = { review: 0, falsify: 0 }
const trail = [], degraded = []
const LEDGER = ledgerList(A.open_findings, 'прежние находки этим прогоном не сверены')
const fmt = (fs) => fs.map(findingLine).join('\n')

phase('Context')
const ctx = await node('сбор предмета ревью', `${HEAD}Шаг 1: предмет ревью. Канал хостинга - MCP платформы через ToolSearch, иначе gh/glab. Возьми метаданные ${A.mr}: base/head SHA, список файлов diff, описание. Реши, трогает ли diff поверхность безопасности, и назови, по чему судил. Источник намерения: ${A.intent || 'не передан - возьми описание MR и связанный тикет; нет и их - "n/a" с перечнем, где искали'}. Код и MR не меняй.`,
  { label: 'ctx:subject', phase: 'Context', effort: 'low', schema: CTX })
trail.push({ step: 1, doer: 'general-purpose', status: ctx ? ctx.status : 'null' })
if (!ctx || ctx.status === 'blocked') return outcome('blocked', 'Context', lack(ctx, 'узел контекста'))

phase('Review')
const reviewerType = DELTA ? 'dex-mr-check-reviewer:mr-check-reviewer' : 'dex-mr-reviewer:mr-reviewer'
const common = `MR/PR: ${A.mr}, BASE_SHA ${ctx.base_sha}, HEAD_SHA ${ctx.head_sha}, файлов ${ctx.files.length}. intent: ${ctx.intent}. publish: false - ноль записей в MR. Код читай с диска: переключи ${A.cwd} на ${ctx.head_sha} (git fetch ссылки MR, затем git checkout --detach); ревизия не достаётся - канал хостинга, и это названо в missing.`
const LEDGER_TEXT = LEDGER.length ? `\nПрежние находки из ledger - по каждой запись в prior с её id, статус с доказательством; находка перечня идёт только в prior, в findings - то, чего в перечне нет:\n${LEDGER.map(priorLine).join('\n')}` : ''
const [rev, sec] = await parallel([
  () => node(DELTA ? 'ре-ревьюер дельты' : 'ревьюер MR', `${HEAD}Шаг 2: ${DELTA ? `ре-ревью дельты: LAST_REVIEW_SHA ${A.last_review_sha}, статус прежних находок, новые находки только в дельте` : 'первичное ревью по осям по характеру diff; незадетая ось - явный n/a с основанием'}. ${common} Оси: language, architecture, business, regressions, performance, non-code; ${ctx.security_surface ? 'security - отдельный узел, здесь не дублируй' : `security: n/a - ${ctx.security_basis}`}. Severity в шкале P0-P3.${DELTA ? ' Прежняя находка из тредов MR, которой нет в перечне ledger, - в threads, не в prior.' : ''}${LEDGER_TEXT}`,
    { label: DELTA ? 'review:delta' : 'review:first', phase: 'Review', schema: REVIEW }, reviewerType),
  () => ctx.security_surface
    ? node('security-ревьюер', `${HEAD}Шаг 2 (security): модель угроз diff и attack-path по OWASP. ${common} Основание поверхности: ${ctx.security_basis}. Только ось security, severity P0-P3.`,
        { label: 'review:security', phase: 'Review', schema: SEC }, 'dex-security-reviewer:security-reviewer')
    : Promise.resolve(null),
])
loops.review = 1
trail.push({ step: 2, doer: reviewerType, status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1 })
trail.push({ step: '2-security', doer: ctx.security_surface ? 'security-reviewer' : 'n/a', status: sec ? sec.status : (ctx.security_surface ? 'null' : 'n/a'), basis: ctx.security_basis })
const secOut = ctx.security_surface ? (sec ? { status: sec.status, axes: sec.axes, threat_model: sec.threat_model, missing: sec.missing } : 'узел не вернул выход') : `n/a - ${ctx.security_basis}`
if (!rev || rev.status === 'blocked') return outcome('blocked', 'Review', lack(rev, 'узел ревью'), { ctx, security: secOut, claims: sec ? sec.findings : [] })
const claims = [].concat(rev.findings, sec ? sec.findings : [])
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
const fal = await node('скептик', `${HEAD}Шаг 3: каждая находка ниже - claim, не факт. Сверь с кодом ветки ${ctx.head_sha}: не закрыта ли соседним коммитом, не опирается ли на неверное чтение контракта, воспроизводится ли сценарий. Не выдержавшую - в dropped с причиной; выдержавшую - в confirmed с уликой. Отдельно вердикт по покрытию изменённого поведения тестами через реальный путь (один happy-path покрытием не считается); непокрытая ветка - находка оси coverage в confirmed. Итоговый review-verdict - по правилу поля review-verdict словаря node-contract (вызови Skill dex-skill-node-contract:node-contract до вердикта): в счёт идут confirmed и сверенные prior со статусом open или partial, вопросы автору - ниже. Код не меняй.\nНаходки:\n${fmt(claims) || '- находок нет: только вердикт по покрытию'}${priorIn.length ? `\nПрежние находки - статус ре-ревьюера claim, не факт: сверь каждую с кодом ${ctx.head_sha}, в prior - запись на каждую с её id, anchor, severity и text, сверенный статус и улика. Статусы ре-ревьюера: closed, partial, open, disputed, no-longer-applicable; disputed - только если код опровергает находку, а не потому что автор возразил; «закрыта» не подтвердилась - open или partial. Находка выше, совпавшая с прежней, идёт в prior с id прежней, не в confirmed:\n${priorIn.map(p => `${priorLine(p)} - ре-ревьюер: ${p.claim ? `${p.claim.status} - ${p.claim.evidence}` : 'статус не назван, сверь сам'}`).join('\n')}` : ''}${rev.questions.length ? `\nВопросы автору от ревьюера:\n${rev.questions.map(q => `- ${q}`).join('\n')}` : ''}`,
  { label: 'falsify+coverage', phase: 'Falsify', schema: FALSIFY })
trail.push({ step: 3, doer: 'general-purpose', status: fal ? fal.status : 'null', confirmed: fal ? fal.confirmed.length : -1, dropped: fal ? fal.dropped.length : -1 })
if (!fal || fal.status === 'blocked') return outcome('blocked', 'Falsify', lack(fal, 'скептик'), { ctx, review: rev, security: secOut, claims, prior: reg.all() })
reg.apply(fal, 'скептик')
const confirmed = []
for (const { f, id } of reg.take(fal.confirmed, 'скептик')) if (id) reg.seat({ ...f, id }, 'open', f.evidence); else confirmed.push(f)
const prior = reg.all()
const unsettled = prior.filter(p => p.status === 'unverified')

phase('Publish')
let pub = null
if (A.publish && confirmed.length) {
  pub = await node('публикатор тредов', `${HEAD}Шаг 4: санкция publish=true получена от оператора. Опубликуй каждую находку инлайн-тредом в ${A.mr} по anchor через канал хостинга (MCP платформы через ToolSearch, иначе gh/glab); severity и критерий закрытия - в тексте треда. До публикации прочитай треды MR своего аккаунта: на том же anchor уже есть тред по этой находке - не публикуй, в published с url существующего и note «уже был». Чужие треды не трогать, approve/request changes не ставить. Отказ канала - тред в unpublished с причиной, находку не терять.\n${fmt(confirmed)}`,
    { label: 'publish', phase: 'Publish', effort: 'low', schema: PUBLISH })
  trail.push({ step: 4, doer: 'general-purpose', status: pub ? pub.status : 'null', published: pub ? pub.published.length : -1 })
}
// Находка без исхода публикатора теряется молча: каждая подтверждённая либо опубликована, либо названа неопубликованной.
// Опознание - same: на одной строке бывают находки разных осей, и названная одна не закрывает другую.
const told = pub ? [...pub.published, ...pub.unpublished] : []
const unpublished = !pub ? confirmed.map(f => ({ anchor: f.anchor, axis: f.axis, reason: A.publish ? 'узел публикации не вернул выход - находки к публикации' : 'санкции publish нет - перечень к публикации' }))
  : [...pub.unpublished, ...confirmed.filter(f => !told.some(t => t.anchor === f.anchor && (t.axis === f.axis || !t.axis || !f.axis))).map(f => ({ anchor: f.anchor, axis: f.axis, reason: `публикатор (${pub.status}): исход по находке не назван` }))]
const allPublished = !A.publish || !confirmed.length || (pub && pub.status === 'complete' && unpublished.length === 0)
const issues = []
if (ledgerUnread) issues.push(LEDGER_UNREAD)
if (ctx.status === 'partial') issues.push(`предмет ревью неполон: ${ctx.missing || 'узел не назвал нехватку'}`)
if (rev.status !== 'complete') issues.push(`ревью не завершено: ${rev.missing || 'узел не назвал нехватку'}`)
// Объявленная поверхность безопасности без полностью отработавшего узла - непроверенная ось, а не чистая.
if (ctx.security_surface && (!sec || sec.status === 'blocked')) issues.push(`ось security не проверена: ${(sec && sec.missing) || 'узел не вернул выход'}`)
else if (ctx.security_surface && sec.status === 'partial') issues.push(`ось security проверена не полностью: ${sec.missing || 'узел не назвал нехватку'}`)
if (fal.status !== 'complete') issues.push(`фальсификация не завершена: ${fal.missing || 'узел не назвал нехватку'}`)
if (unsettled.length) issues.push(`статус прежних находок не сверен скептиком: ${unsettled.map(p => p.anchor).join(', ')}`)
if (!allPublished) issues.push('часть тредов не опубликована')
// Вердикт выносит скептик, но опровергнуть его открытыми находками может и трек: APPROVE при открытой P0/P1 себя опровергает (BR-AUTO-003).
const openBlocking = [...confirmed, ...prior.filter(isOpen)].filter(isBlocking)
if (fal['review-verdict'] === 'APPROVE' && openBlocking.length) issues.push(`review-verdict APPROVE при открытых P0/P1: ${openBlocking.map(f => f.id || f.anchor).join(', ')}`)
const where = issues.join('; ')
return outcome(where ? 'partial' : 'complete', where, where, {
  subject: { mr: A.mr, base_sha: ctx.base_sha, head_sha: ctx.head_sha, files: ctx.files.length, platform: ctx.platform },
  intent: ctx.intent, 'review-verdict': fal['review-verdict'], reviewer_verdict: rev['review-verdict'], axes: rev.axes, prior, questions: rev.questions,
  security: secOut,
  confirmed, dropped: fal.dropped, coverage: fal.coverage,
  published: pub ? pub.published : [],
  unpublished,
})
