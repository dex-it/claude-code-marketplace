// Трек ревью чужого MR/PR как Workflow-скрипт (artifacts.md, O12 вариант A). Read-only: код не правится.
// Вход через args: { task, mr, intent, mode, publish, last_review_sha, cwd }.
// Публикация тредов - outward-facing: только при publish=true (флаг --post команды), иначе перечень в возврате.
export const meta = {
  name: 'dex-auto-review',
  description: 'Трек ревью MR/PR: контекст -> ревью по осям (+ security по поверхности) -> фальсификация и покрытие -> публикация по санкции',
  phases: [
    { title: 'Context', detail: 'предмет ревью: SHA, объём diff, поверхность безопасности, источник намерения' },
    { title: 'Review', detail: 'mr-reviewer либо mr-check-reviewer на дельте; security-reviewer отдельным узлом' },
    { title: 'Falsify', detail: 'каждая находка - claim: сверка с кодом ветки и вердикт по покрытию' },
    { title: 'Publish', detail: 'инлайн-треды при publish=true; иначе перечень к публикации' },
  ],
}

const A = args || {}
const DELTA = !!A.last_review_sha
const HEAD = `mode: ${A.mode || 'autonomous'}\nцель (${A.task}): ревью ${A.mr}${DELTA ? ` - ревизия дельты от ${A.last_review_sha}` : ''}.\nread-only: код не менять, тесты не писать, в MR ничего не публиковать - публикует отдельный узел по санкции.\nРаботай из ${A.cwd}. Оператора нет: невыводимое верни status: blocked с полем нехватки; неясность намерения по diff - вопрос автору в перечне, не оператору.\n`

const STATUS = { type: 'string', enum: ['complete', 'blocked', 'partial'] }
const FINDING = { type: 'object', properties: {
  anchor: { type: 'string', description: 'file:line' }, severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
  axis: { type: 'string', enum: ['security', 'architecture', 'language', 'business', 'regressions', 'performance', 'coverage', 'non-code'] },
  text: { type: 'string' }, closure: { type: 'string', description: 'критерий закрытия' }, evidence: { type: 'string' },
}, required: ['anchor', 'severity', 'axis', 'text', 'closure', 'evidence'] }
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
  verdict: { type: 'string', enum: ['APPROVE', 'REQUEST_CHANGES', 'NEEDS_DISCUSSION'] },
  prior: { type: 'array', items: { type: 'string' }, description: 'ревизия дельты: статус каждой прежней находки; иначе пусто' },
  questions: { type: 'array', items: { type: 'string' }, description: 'вопросы автору по намерению' },
  missing: { type: 'string' },
}, required: ['status', 'findings', 'axes', 'verdict', 'prior', 'questions', 'missing'] }
const FALSIFY = { type: 'object', properties: {
  status: STATUS,
  confirmed: { type: 'array', items: FINDING },
  dropped: { type: 'array', items: { type: 'object', properties: { anchor: { type: 'string' }, reason: { type: 'string' } }, required: ['anchor', 'reason'] } },
  coverage: { type: 'string', description: 'вердикт по покрытию изменённого поведения: непокрытые ветки поимённо либо "покрыто: <чем>"' },
  missing: { type: 'string' },
}, required: ['status', 'confirmed', 'dropped', 'coverage', 'missing'] }
const PUBLISH = { type: 'object', properties: {
  status: STATUS,
  published: { type: 'array', items: { type: 'object', properties: { anchor: { type: 'string' }, url: { type: 'string' } }, required: ['anchor', 'url'] } },
  unpublished: { type: 'array', items: { type: 'object', properties: { anchor: { type: 'string' }, reason: { type: 'string' } }, required: ['anchor', 'reason'] } },
}, required: ['status', 'published', 'unpublished'] }

const loops = { review: 0, falsify: 0 }
const trail = [], degraded = []
async function node(role, prompt, opts, type) {
  if (type) {
    try { const r = await agent(prompt, { ...opts, agentType: type }); return r }
    catch (e) { degraded.push(`${role}: ${type} недоступен (${String(e && e.message || e).slice(0, 120)})`); log(`узел ${type} недоступен, general-purpose`) }
  }
  return agent(`Роль: ${role}.\n${prompt}`, { ...opts, agentType: 'general-purpose' })
}
const fmt = (fs) => fs.map(f => `- [${f.severity}] ${f.axis} ${f.anchor}: ${f.text} (закрытие: ${f.closure})`).join('\n')

phase('Context')
const ctx = await node('сбор предмета ревью', `${HEAD}Шаг 1: предмет ревью. Канал хостинга - MCP платформы через ToolSearch, иначе gh/glab. Возьми метаданные ${A.mr}: base/head SHA, список файлов diff, описание. Реши, трогает ли diff поверхность безопасности, и назови, по чему судил. Источник намерения: ${A.intent || 'не передан - возьми описание MR и связанный тикет; нет и их - "n/a" с перечнем, где искали'}. Код и MR не меняй.`,
  { label: 'ctx:subject', phase: 'Context', effort: 'low', schema: CTX })
trail.push({ step: 1, doer: 'general-purpose', status: ctx ? ctx.status : 'null' })
if (!ctx || ctx.status === 'blocked') return { status: 'blocked', where: 'Context', missing: ctx ? ctx.missing : 'узел контекста не вернул выход', loops, trail, degraded }

phase('Review')
const reviewerType = DELTA ? 'dex-mr-check-reviewer:mr-check-reviewer' : 'dex-mr-reviewer:mr-reviewer'
const common = `MR/PR: ${A.mr}, BASE_SHA ${ctx.base_sha}, HEAD_SHA ${ctx.head_sha}, файлов ${ctx.files.length}. intent: ${ctx.intent}. publish: false - ноль записей в MR. Код читай с диска в ветке MR либо через канал хостинга.`
const [rev, sec] = await parallel([
  () => node(DELTA ? 'ре-ревьюер дельты' : 'ревьюер MR', `${HEAD}Шаг 2: ${DELTA ? `ре-ревью дельты: LAST_REVIEW_SHA ${A.last_review_sha}, статус прежних находок, новые находки только в дельте` : 'первичное ревью по осям по характеру diff; незадетая ось - явный n/a с основанием'}. ${common} Оси: language, architecture, business, regressions, performance, non-code; security - отдельный узел, здесь не дублируй. Severity в шкале P0-P3.`,
    { label: DELTA ? 'review:delta' : 'review:first', phase: 'Review', schema: REVIEW }, reviewerType),
  () => ctx.security_surface
    ? node('security-ревьюер', `${HEAD}Шаг 2 (security): модель угроз diff и attack-path по OWASP. ${common} Основание поверхности: ${ctx.security_basis}. Только ось security, severity P0-P3.`,
        { label: 'review:security', phase: 'Review', schema: REVIEW }, 'dex-security-reviewer:security-reviewer')
    : Promise.resolve(null),
])
loops.review = 1
trail.push({ step: 2, doer: reviewerType, status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1 })
trail.push({ step: '2-security', doer: ctx.security_surface ? 'security-reviewer' : 'n/a', status: sec ? sec.status : (ctx.security_surface ? 'null' : 'n/a'), basis: ctx.security_basis })
if (!rev || rev.status === 'blocked') return { status: 'blocked', where: 'Review', missing: rev ? rev.missing : 'узел ревью не вернул выход', ctx, loops, trail, degraded }
// Объявленная поверхность безопасности без отработавшего узла - непроверенная ось, а не чистая: исход трека это обязан отражать.
const secFail = ctx.security_surface && (!sec || sec.status === 'blocked')
const claims = [].concat(rev.findings, sec ? sec.findings : [])

phase('Falsify')
loops.falsify = 1
const fal = await node('скептик', `${HEAD}Шаг 3: каждая находка ниже - claim, не факт. Сверь с кодом ветки ${ctx.head_sha}: не закрыта ли соседним коммитом, не опирается ли на неверное чтение контракта, воспроизводится ли сценарий. Не выдержавшую - в dropped с причиной; выдержавшую - в confirmed с уликой. Отдельно вердикт по покрытию изменённого поведения тестами через реальный путь (один happy-path покрытием не считается); непокрытая ветка - находка оси coverage в confirmed. Код не меняй.\nНаходки:\n${fmt(claims) || '- находок нет: только вердикт по покрытию'}`,
  { label: 'falsify+coverage', phase: 'Falsify', schema: FALSIFY })
trail.push({ step: 3, doer: 'general-purpose', status: fal ? fal.status : 'null', confirmed: fal ? fal.confirmed.length : -1, dropped: fal ? fal.dropped.length : -1 })
if (!fal || fal.status === 'blocked') return { status: 'blocked', where: 'Falsify', missing: fal ? fal.missing || 'скептик вернул blocked без нехватки' : 'скептик не вернул выход - находки не проверены', ctx, review: rev, security: sec, claims, loops, trail, degraded }

phase('Publish')
let pub = null
if (A.publish && fal.confirmed.length) {
  pub = await node('публикатор тредов', `${HEAD}Шаг 4: санкция publish=true получена от оператора. Опубликуй каждую находку инлайн-тредом в ${A.mr} по anchor через канал хостинга (MCP платформы через ToolSearch, иначе gh/glab); severity и критерий закрытия - в тексте треда. Чужие треды не трогать, approve/request changes не ставить. Отказ канала - тред в unpublished с причиной, находку не терять.\n${fmt(fal.confirmed)}`,
    { label: 'publish', phase: 'Publish', effort: 'low', schema: PUBLISH })
  trail.push({ step: 4, doer: 'general-purpose', status: pub ? pub.status : 'null', published: pub ? pub.published.length : -1 })
}
const allPublished = !A.publish || !fal.confirmed.length || (pub && pub.status === 'complete' && pub.unpublished.length === 0)
const issues = []
if (!allPublished) issues.push('часть тредов не опубликована')
if (fal.status !== 'complete') issues.push(`фальсификация не завершена: ${fal.missing || 'узел не назвал нехватку'}`)
if (secFail) issues.push(`ось security не проверена: ${(sec && sec.missing) || 'узел не вернул выход'}`)
return {
  status: issues.length ? 'partial' : 'complete',
  where: issues.join('; '),
  subject: { mr: A.mr, base_sha: ctx.base_sha, head_sha: ctx.head_sha, files: ctx.files.length, platform: ctx.platform },
  intent: ctx.intent, verdict: rev.verdict, axes: rev.axes, prior: rev.prior, questions: rev.questions,
  security: ctx.security_surface ? (sec ? { status: sec.status, axes: sec.axes, missing: sec.missing } : 'узел не вернул выход') : `n/a - ${ctx.security_basis}`,
  confirmed: fal.confirmed, dropped: fal.dropped, coverage: fal.coverage,
  published: pub ? pub.published : [],
  unpublished: pub ? pub.unpublished : fal.confirmed.map(f => ({ anchor: f.anchor, reason: A.publish ? 'узел публикации не вернул выход - находки к публикации' : 'санкции publish нет - перечень к публикации' })),
  loops, trail, degraded,
}
