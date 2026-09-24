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

const STATUS = { type: 'string', enum: ['complete', 'blocked', 'partial'] }
const FINDING = { type: 'object', properties: {
  anchor: { type: 'string', description: 'file:line' }, severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'], description: 'уровень словаря node-contract: P0 = CRITICAL, P1 = HIGH, P2 = MEDIUM, P3 = LOW' },
  axis: { type: 'string', enum: ['security', 'architecture', 'language', 'business', 'regressions', 'performance', 'coverage', 'non-code'] },
  text: { type: 'string' }, closure: { type: 'string', description: 'критерий закрытия' }, evidence: { type: 'string' },
}, required: ['anchor', 'severity', 'axis', 'text', 'closure', 'evidence'] }
// Прежняя находка опознаётся по id реестра ledger: без него finish.sh заводит её новой, и разность «открытые» двоится.
const PRIOR = { type: 'object', properties: {
  id: { type: 'string', description: 'id из перечня прежних находок; найдена в тредах MR, в перечне её нет - пусто' },
  anchor: FINDING.properties.anchor, severity: FINDING.properties.severity, text: { type: 'string' },
  status: { type: 'string', enum: ['closed', 'partial', 'open', 'disputed', 'no-longer-applicable'] }, evidence: { type: 'string' },
}, required: ['id', 'anchor', 'severity', 'text', 'status', 'evidence'] }
const CTX = { type: 'object', properties: {
  status: STATUS, platform: { type: 'string', enum: ['github', 'gitlab', 'other'] },
  base_sha: { type: 'string' }, head_sha: { type: 'string' }, files: { type: 'array', items: { type: 'string' } },
  security_surface: { type: 'boolean', description: 'diff трогает auth, внешний ввод, секреты, границу доверия, зависимости' },
  security_basis: { type: 'string', description: 'по чему судили о поверхности' },
  intent: { type: 'string', description: 'источник намерения с адресом либо "n/a: <где искали>"' },
  missing: { type: 'string' },
}, required: ['status', 'platform', 'base_sha', 'head_sha', 'files', 'security_surface', 'security_basis', 'intent', 'missing'] }
const REVIEW = { type: 'object', properties: {
  status: STATUS, findings: { type: 'array', items: FINDING },
  axes: { type: 'array', items: { type: 'string' }, description: 'исход каждой оси: "<ось>: находки N" | "<ось>: чисто, проверено <что>" | "<ось>: n/a - <чего в diff нет>"' },
  'review-verdict': { type: 'string', enum: ['APPROVE', 'REQUEST_CHANGES', 'NEEDS_DISCUSSION'] },
  prior: { type: 'array', items: PRIOR, description: 'по каждой прежней находке - статус с доказательством; прежних нет - пусто' },
  questions: { type: 'array', items: { type: 'string' }, description: 'вопросы автору по намерению' },
  missing: { type: 'string' },
}, required: ['status', 'findings', 'axes', 'review-verdict', 'prior', 'questions', 'missing'] }
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
// Реестр ledger приходит массивом либо строкой JSON (вывод ledger.py findings). Непригодное поле прогон не
// останавливает: записи ledger без события этого прогона остаются открытыми сами.
const LEDGER = (() => {
  const v = A.open_findings
  if (v === undefined || v === null || v === '') return []
  let list = v
  if (typeof v === 'string') { try { list = JSON.parse(v) } catch (e) { list = null } }
  if (!Array.isArray(list)) { degraded.push('поле open_findings не JSON-массив реестра ledger - прежние находки этим прогоном не сверены'); return [] }
  return list.filter(f => f && typeof f === 'object')
})()
// Опознание прежней: по id, когда он есть у обеих сторон, иначе по anchor.
const same = (a, b) => a.id && b.id ? a.id === b.id : a.anchor === b.anchor
const priorLine = (p) => `- ${p.id ? `${p.id} ` : ''}[${p.severity}] ${p.anchor}: ${p.text}`
async function node(role, prompt, opts, type) {
  if (type) {
    try { const r = await agent(prompt, { ...opts, agentType: type }); return r }
    catch (e) { degraded.push(`${role}: ${type} недоступен (${String(e && e.message || e).slice(0, 120)})`); log(`узел ${type} недоступен, general-purpose`) }
  }
  return agent(`Роль: ${role}.\n${prompt}`, { ...opts, agentType: 'general-purpose' })
}
const fmt = (fs) => fs.map(f => `- [${f.severity}] ${f.axis} ${f.anchor}: ${f.text} (закрытие: ${f.closure})\n  улика: ${f.evidence}`).join('\n')

phase('Context')
const ctx = await node('сбор предмета ревью', `${HEAD}Шаг 1: предмет ревью. Канал хостинга - MCP платформы через ToolSearch, иначе gh/glab. Возьми метаданные ${A.mr}: base/head SHA, список файлов diff, описание. Реши, трогает ли diff поверхность безопасности, и назови, по чему судил. Источник намерения: ${A.intent || 'не передан - возьми описание MR и связанный тикет; нет и их - "n/a" с перечнем, где искали'}. Код и MR не меняй.`,
  { label: 'ctx:subject', phase: 'Context', effort: 'low', schema: CTX })
trail.push({ step: 1, doer: 'general-purpose', status: ctx ? ctx.status : 'null' })
const lack = (r, none) => r ? r.missing || 'узел вернул blocked без нехватки' : none
if (!ctx || ctx.status === 'blocked') return { status: 'blocked', where: 'Context', missing: lack(ctx, 'узел контекста не вернул выход'), loops, trail, degraded }

phase('Review')
const reviewerType = DELTA ? 'dex-mr-check-reviewer:mr-check-reviewer' : 'dex-mr-reviewer:mr-reviewer'
const common = `MR/PR: ${A.mr}, BASE_SHA ${ctx.base_sha}, HEAD_SHA ${ctx.head_sha}, файлов ${ctx.files.length}. intent: ${ctx.intent}. publish: false - ноль записей в MR. Код читай с диска: переключи ${A.cwd} на ${ctx.head_sha} (git fetch ссылки MR, затем git checkout --detach); ревизия не достаётся - канал хостинга, и это названо в missing.`
const LEDGER_TEXT = LEDGER.length ? `\nПрежние находки из ledger - статус каждой в prior с тем же id; находка из перечня, оставшаяся в коде, идёт в prior, не в findings:\n${LEDGER.map(priorLine).join('\n')}` : ''
const [rev, sec] = await parallel([
  () => node(DELTA ? 'ре-ревьюер дельты' : 'ревьюер MR', `${HEAD}Шаг 2: ${DELTA ? `ре-ревью дельты: LAST_REVIEW_SHA ${A.last_review_sha}, статус прежних находок, новые находки только в дельте` : 'первичное ревью по осям по характеру diff; незадетая ось - явный n/a с основанием'}. ${common} Оси: language, architecture, business, regressions, performance, non-code; ${ctx.security_surface ? 'security - отдельный узел, здесь не дублируй' : `security: n/a - ${ctx.security_basis}`}. Severity в шкале P0-P3.${DELTA ? ' Прежняя находка из тредов MR, которой нет в перечне ledger, - в prior с пустым id.' : ''}${LEDGER_TEXT}`,
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
if (!rev || rev.status === 'blocked') return { status: 'blocked', where: 'Review', missing: lack(rev, 'узел ревью не вернул выход'), ctx, security: secOut, claims: sec ? sec.findings : [], loops, trail, degraded }
const claims = [].concat(rev.findings, sec ? sec.findings : [])
// Суду скептика подлежит каждая прежняя: из ledger - с заявлением ревьюера либо без него, из тредов - заявление ревьюера.
const priorIn = [...LEDGER.map(l => ({ id: l.id || '', anchor: l.anchor || '', severity: l.severity || '', text: l.text || '', claim: rev.prior.find(r => same(r, l)) })),
  ...rev.prior.filter(r => !LEDGER.some(l => same(r, l))).map(r => ({ id: r.id || '', anchor: r.anchor, severity: r.severity, text: r.text, claim: r }))]
const unverified = (p, why) => ({ id: p.id, anchor: p.anchor, severity: p.severity, text: p.text, status: 'unverified', evidence: why })

phase('Falsify')
loops.falsify = 1
const fal = await node('скептик', `${HEAD}Шаг 3: каждая находка ниже - claim, не факт. Сверь с кодом ветки ${ctx.head_sha}: не закрыта ли соседним коммитом, не опирается ли на неверное чтение контракта, воспроизводится ли сценарий. Не выдержавшую - в dropped с причиной; выдержавшую - в confirmed с уликой. Отдельно вердикт по покрытию изменённого поведения тестами через реальный путь (один happy-path покрытием не считается); непокрытая ветка - находка оси coverage в confirmed. Итоговый review-verdict - по правилу поля review-verdict словаря node-contract (вызови Skill dex-skill-node-contract:node-contract до вердикта): в счёт идут confirmed и сверенные prior со статусом open или partial, вопросы автору - ниже. Код не меняй.\nНаходки:\n${fmt(claims) || '- находок нет: только вердикт по покрытию'}${priorIn.length ? `\nПрежние находки - статус ре-ревьюера claim, не факт: сверь каждую с кодом ${ctx.head_sha}, в prior - запись на каждую с её id, anchor, severity и text, сверенный статус и улика. Статусы ре-ревьюера: closed, partial, open, disputed, no-longer-applicable; disputed - только если код опровергает находку, а не потому что автор возразил; «закрыта» не подтвердилась - open или partial. Находка из перечня выше, совпавшая с прежней, идёт в prior прежней, не в confirmed:\n${priorIn.map(p => `${priorLine(p)} - ре-ревьюер: ${p.claim ? `${p.claim.status} - ${p.claim.evidence}` : 'статус не назван, сверь сам'}`).join('\n')}` : ''}${rev.questions.length ? `\nВопросы автору от ревьюера:\n${rev.questions.map(q => `- ${q}`).join('\n')}` : ''}`,
  { label: 'falsify+coverage', phase: 'Falsify', schema: FALSIFY })
trail.push({ step: 3, doer: 'general-purpose', status: fal ? fal.status : 'null', confirmed: fal ? fal.confirmed.length : -1, dropped: fal ? fal.dropped.length : -1 })
if (!fal || fal.status === 'blocked') return { status: 'blocked', where: 'Falsify', missing: fal ? fal.missing || 'скептик вернул blocked без нехватки' : 'скептик не вернул выход - находки не проверены', ctx, review: rev, security: secOut, claims, prior: priorIn.map(p => unverified(p, 'скептик не вернул выход')), loops, trail, degraded }
// Прежняя, о которой скептик промолчал, не закрыта и не открыта - непроверена, и ревью с ней не сдаётся полным.
const prior = [...priorIn.map(p => { const got = fal.prior.find(f => same(f, p)); return got ? { id: p.id, anchor: p.anchor, severity: p.severity, text: p.text, status: got.status, evidence: got.evidence } : unverified(p, 'статус скептиком не сверен') }),
  ...fal.prior.filter(f => !priorIn.some(p => same(f, p)))]
const unsettled = prior.filter(p => p.status === 'unverified')

phase('Publish')
let pub = null
if (A.publish && fal.confirmed.length) {
  pub = await node('публикатор тредов', `${HEAD}Шаг 4: санкция publish=true получена от оператора. Опубликуй каждую находку инлайн-тредом в ${A.mr} по anchor через канал хостинга (MCP платформы через ToolSearch, иначе gh/glab); severity и критерий закрытия - в тексте треда. До публикации прочитай треды MR своего аккаунта: на том же anchor уже есть тред по этой находке - не публикуй, в published с url существующего и note «уже был». Чужие треды не трогать, approve/request changes не ставить. Отказ канала - тред в unpublished с причиной, находку не терять.\n${fmt(fal.confirmed)}`,
    { label: 'publish', phase: 'Publish', effort: 'low', schema: PUBLISH })
  trail.push({ step: 4, doer: 'general-purpose', status: pub ? pub.status : 'null', published: pub ? pub.published.length : -1 })
}
// Находка без исхода публикатора теряется молча: каждая подтверждённая либо опубликована, либо названа неопубликованной.
// Ключ - anchor и ось: на одной строке бывают находки разных осей, и названная одна не закрывает другую.
const key = (t) => `${t.anchor}|${t.axis}`
const told = new Set(pub ? [...pub.published, ...pub.unpublished].map(key) : [])
const unpublished = !pub ? fal.confirmed.map(f => ({ anchor: f.anchor, axis: f.axis, reason: A.publish ? 'узел публикации не вернул выход - находки к публикации' : 'санкции publish нет - перечень к публикации' }))
  : [...pub.unpublished, ...fal.confirmed.filter(f => !told.has(key(f))).map(f => ({ anchor: f.anchor, axis: f.axis, reason: `публикатор (${pub.status}): исход по находке не назван` }))]
const allPublished = !A.publish || !fal.confirmed.length || (pub && pub.status === 'complete' && unpublished.length === 0)
const issues = []
if (ctx.status === 'partial') issues.push(`предмет ревью неполон: ${ctx.missing || 'узел не назвал нехватку'}`)
if (rev.status !== 'complete') issues.push(`ревью не завершено: ${rev.missing || 'узел не назвал нехватку'}`)
// Объявленная поверхность безопасности без полностью отработавшего узла - непроверенная ось, а не чистая.
if (ctx.security_surface && (!sec || sec.status === 'blocked')) issues.push(`ось security не проверена: ${(sec && sec.missing) || 'узел не вернул выход'}`)
else if (ctx.security_surface && sec.status === 'partial') issues.push(`ось security проверена не полностью: ${sec.missing || 'узел не назвал нехватку'}`)
if (fal.status !== 'complete') issues.push(`фальсификация не завершена: ${fal.missing || 'узел не назвал нехватку'}`)
if (unsettled.length) issues.push(`статус прежних находок не сверен скептиком: ${unsettled.map(p => p.anchor).join(', ')}`)
if (!allPublished) issues.push('часть тредов не опубликована')
// Вердикт выносит скептик, но опровергнуть его открытыми находками может и трек: APPROVE при открытой P0/P1 себя опровергает (BR-AUTO-003).
const openBlocking = [...fal.confirmed, ...prior.filter(p => p.status === 'open' || p.status === 'partial')].filter(f => f.severity === 'P0' || f.severity === 'P1')
if (fal['review-verdict'] === 'APPROVE' && openBlocking.length) issues.push(`review-verdict APPROVE при открытых P0/P1: ${openBlocking.map(f => f.id || f.anchor).join(', ')}`)
const where = issues.join('; ')
return {
  status: where ? 'partial' : 'complete',
  where, missing: where,
  subject: { mr: A.mr, base_sha: ctx.base_sha, head_sha: ctx.head_sha, files: ctx.files.length, platform: ctx.platform },
  intent: ctx.intent, 'review-verdict': fal['review-verdict'], reviewer_verdict: rev['review-verdict'], axes: rev.axes, prior, questions: rev.questions,
  security: secOut,
  confirmed: fal.confirmed, dropped: fal.dropped, coverage: fal.coverage,
  published: pub ? pub.published : [],
  unpublished,
  loops, trail, degraded,
}
