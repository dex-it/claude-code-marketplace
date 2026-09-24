// Трек feature как Workflow-скрипт (artifacts.md, O12 вариант A; форма проверена probes.md P9, P11).
// Вход через args: { task, goal, done, boundary, mode, cwd, main_cwd, source, goal_path, resume, trail, open_findings, ctx }.
// Обязательства формы: status первым полем каждой схемы; потолки петель в скрипте; схема несёт
// поле под каждую часть контракта узла; нумерацию единиц отдаёт узел контекста.
export const meta = {
  name: 'dex-auto-feature',
  description: 'Трек feature: контекст R/I параллельно подготовке дерева -> правка с верификацией (потолок 3) -> саморевью -> правка по находкам (потолок 1)',
  phases: [
    { title: 'Context', detail: 'параллельно: R/I из цели, кода и корпуса документации проекта параллельно подготовке дерева по манифесту стека' },
    { title: 'Implement', detail: 'узел-кодер по стеку x верификация внешним фактом, потолок 3; при возобновлении - сначала верификация' },
    { title: 'Review', detail: 'саморевью, при блокирующих находках одна правка с верификацией и повторное ревью' },
  ],
}

const A = args || {}
const FIX_CEILING = 3, REVIEW_FIX_CEILING = 1
// Дерево, стоп-линии и отсутствие оператора одинаковы для любого узла трека; цель и критерий
// несёт только тот, кто их исполняет.
const TREE = `Работай только внутри ${A.cwd}: это отдельное git worktree трека на ветке auto/${A.task}, чужой работы в нём нет - всё незакоммиченное и все падения сборки и тестов в нём твои. Правку и запуск вне дерева отбивает хук: каждая команда Bash называет дерево (cd ${A.cwd} && ...) и не называет каталог сессии - чужое читается Read и Grep, не через Bash; составная команда со вторым звеном в каталоге сессии отбивается целиком.${A.main_cwd ? ` Каталог сессии ${A.main_cwd} - только на чтение (готовые локальные зависимости), правок в нём не делать.` : ''} Push, деплой, миграции данных и удаление вне рабочего дерева не делать - это стоп-линия. Оператора нет: невыводимое не додумывай, верни status: blocked с полем нехватки.\n`
const HEAD = `mode: ${A.mode || 'autonomous'}\nцель (${A.task}): ${A.goal}\nкритерий «готово»: ${A.done}\nграница: ${A.boundary || 'не выходить за рабочий каталог'}\nфайл цели: ${A.goal_path || 'нет'}\ndecision-log: n/a (трек журнал решений не ведёт; решения - полем decisions)\n${TREE}`
// Узел подготовки цели не получает: прочитав её первой строкой, он реализует фичу целиком, и
// хвостовой запрет его не держит (зонд P25). Предмет узла - дерево, и шапка несёт только его.
const PREP_HEAD = `mode: ${A.mode || 'autonomous'}\nзадача (${A.task}): подготовить дерево трека к сборке и тестам - и только это. Цель трека тебе не передана намеренно: реализацию ведёт другой узел, и код в дереве не твой предмет.\n${TREE}`
// Возобновление - это «продолжить» плюс след прошлого прогона: без следа прогона не было, и возобновлять нечего.
const resuming = !!(A.resume && A.trail)
const DONE = resuming ? `\nВозобновление: шаги ниже уже сделаны (из ledger), не повторяй их, продолжай с незакрытого:\n${A.trail}\n` : ''

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
// <<< shared: domain
// >>> shared: verify
const VERIFY = { type: 'object', properties: {
  status: STATUS,
  exit_code: { type: 'integer' }, pass_count: { type: 'integer' }, fail_count: { type: 'integer' },
  failing: { type: 'array', items: { type: 'string' } },
  build_ok: { type: 'boolean' },
  head: { type: 'string', description: 'git log --oneline -3' },
  dirty: { type: 'boolean', description: 'git status --porcelain непустой' },
  ahead: { type: 'integer', description: 'коммитов ветки трека, которых нет ни на одной другой ветке' },
  missing: { type: 'string', description: 'при blocked - почему прогон не выполнен; иначе пусто' },
}, required: ['status', 'exit_code', 'pass_count', 'fail_count', 'failing', 'build_ok', 'head', 'dirty', 'ahead', 'missing'] }
const VERIFY_CMDS = 'git log --oneline -3, git status --porcelain и git rev-list --count HEAD --not --exclude="$(git branch --show-current)" --branches (это ahead)'
// Верификатор, не сумевший прогнать, по exit_code неотличим от красных тестов: без этой ветки трек проедает потолок правок вхолостую.
const noRun = (v) => !v || v.status === 'blocked'
// exit 0 при упавших тестах даёт конвейер в команде раннера; ноль прошедших при команде тестов - прогон, не бывший прогоном тестов.
const isGreen = (v, testCmd) => !!v && v.exit_code === 0 && v.fail_count === 0 && v.build_ok && !v.dirty && !(testCmd && v.pass_count === 0)
const redNote = (v) => `exit=${v.exit_code}, build_ok=${v.build_ok}, прошло тестов: ${v.pass_count}, падают: ${v.failing.join('; ') || 'нет'}, dirty=${v.dirty}`
// <<< shared: verify
// >>> shared: self-review
const CODER = { ts: 'dex-ts-fullstack-coder:ts-fullstack-assistant', dotnet: 'dex-dotnet-coder:dotnet-coder' }
// Ключи - имена словаря node-contract буквально: трансляция - место тихого расхождения схемы и словаря, а описание поля резолвится только дословным ключом.
const FIX = { type: 'object', properties: {
  status: STATUS,
  'diff-scope': { type: 'array', items: { type: 'string' } },
  commit: { type: 'string', description: 'sha локального коммита либо пусто' },
  'run-status': { type: 'string', description: 'зелёность трек судит VERIFY-узлом, не этим полем' },
  'red-run': { type: 'string' },
  // Признак замкнутости - enum: свободную строку модель отдаёт синонимами, а пустое значение неотличимо от невыясненного.
  'uncovered-status': { type: 'string', enum: ['none', 'some', 'unknown'], description: 'осталось ли непокрытое тестами: none - не осталось, some - перечень в uncovered, unknown - покрытие не выяснялось; догадка сюда не пишется' },
  uncovered: { type: 'array', items: { type: 'string' }, description: 'при some - непокрытое перечнем (ветка, случай, граница); иначе пустой' },
  'dependents-status': { type: 'string', enum: ['none', 'some', 'unknown'], description: 'видно ли правку за пределами diff-scope: вызывающий код, контракт на проводе, схема данных, публичный API. none - не видно, some - видно (перечень в dependents), unknown - не разобрался; догадка сюда не пишется' },
  dependents: { type: 'array', items: { type: 'string' }, description: 'при some - потребители перечнем file:line; иначе пустой' },
  'fact-check': { type: 'string', description: 'триггер сверки - сигнатура или поведение стороннего API, взятые по памяти' },
  decisions: { type: 'array', items: { type: 'string' }, description: 'каждая закрытая узлом развилка: что выбрано, из чего, почему' },
  prior: { type: 'array', items: PRIOR, description: 'по каждой находке из задания - статус с уликой: closed - закрыта правкой, disputed - закрывать не следует; находок в задании нет - пусто' },
  missing: { type: 'string' },
}, required: ['status', 'diff-scope', 'commit', 'run-status', 'red-run', 'uncovered-status', 'uncovered', 'dependents-status', 'dependents', 'fact-check', 'decisions', 'prior', 'missing'] }
const REVIEW = { type: 'object', properties: {
  status: STATUS,
  findings: { type: 'array', items: FINDING },
  'run-status': { type: 'string', description: 'прогон свой, не пересказ входа' },
  'red-run': { type: 'string', description: 'вердикт по записям red-run кодера во входе: по каждому тесту дельты запись действует / отсутствует / истекла; записей не было - unverifiable + что искал; тестов в дельте нет - n/a' },
  'fact-check': { type: 'string', description: 'предмет сверки - техутверждения находок' },
  intent: { type: 'string', description: 'сверка с источником намерения входа: соответствует / расхождения «корректно, но не то»; источника нет - n/a' },
  'intent-status': { type: 'string', enum: ['match', 'mismatch', 'n/a'], description: 'mismatch - сделано не то, чего требует источник намерения входа; подробности в intent' },
  prior: { type: 'array', items: PRIOR, description: 'по каждой прежней находке входа - статус с уликой; прежних нет - пусто' },
  'review-verdict': { type: 'string', enum: ['APPROVE', 'REQUEST_CHANGES', 'NEEDS_DISCUSSION'], description: 'по правилу поля review-verdict из node-contract; сигнал оператору, порог допуска трека его не читает' },
  missing: { type: 'string', description: 'при blocked - чего не хватило для ревью; иначе пусто' },
}, required: ['status', 'findings', 'run-status', 'red-run', 'fact-check', 'intent', 'intent-status', 'prior', 'review-verdict', 'missing'] }
const UNSETTLED = 'статус саморевью не сверен'
// fix перезаписывается каждой попыткой: решения и оспаривание прежней находки без переноса в decisions до выхода не доезжают.
const said = (f) => [...(f.decisions || []), ...(f.prior || []).filter(p => p.status === 'disputed').map(p => `${p.id || p.anchor}: кодер оспорил закрытие - ${p.evidence}`)]
// Записи red-run и uncovered кодера - вход саморевьюера: он судит red-run по записям входа, а uncovered адресован следующему узлу.
const coderInput = (f) => f ? `\nВход от кодера - red-run: ${f['red-run']}\nuncovered: ${f['uncovered-status']}${(f.uncovered || []).length ? ' - ' + f.uncovered.join('; ') : ''}\ndependents: ${f['dependents-status']}${(f.dependents || []).length ? ' - ' + f.dependents.join('; ') : ''}` : ''
const blockingOf = (r) => r ? r.findings.filter(isBlocking) : []
// Повторное ревью правке, целиком проверенной прогоном и не видимой наружу, нового факта не даёт (ledger: окупалось в 5 из 23); unknown и перечень при none пропуск не дают.
const sealed = (f) => f['uncovered-status'] === 'none' && (f.uncovered || []).length === 0 && f['dependents-status'] === 'none' && (f.dependents || []).length === 0
// Отказ кодера и его молчание - не закрытие.
const closedBy = (f, x) => ((f && f.prior) || []).some(p => same(p, x) && p.status === 'closed')
const SKIPPED = 'закрыта правкой, повторное саморевью не куплено - правка покрыта прогоном (uncovered-status: none), наружу не видна (dependents-status: none), верификация зелёная'
// partial кодера и опровергнутая им сверка - исход автора: зелёная верификация и чистое ревью их не закрывают.
const authorGap = (f) => !f ? '' : f.status === 'partial' ? `кодер вернул partial: ${f.missing || f['run-status'] || 'нехватка не названа'}` : /^contradicted/.test(f['fact-check'] || '') ? `fact-check кодера: ${f['fact-check']}` : ''
const reviewGap = (r) => !r || r.status === 'blocked' ? '' : r.status === 'partial' ? `саморевью не завершено: ${r.missing || 'нехватка не названа'}` : r['intent-status'] === 'mismatch' ? `саморевью: реализовано не то: ${r.intent}` : ''
// Порог допуска: зелёная верификация и ноль открытых P0/P1, своих и прежних; review-verdict - сигнал оператору, порог его не читает.
const admit = (green, rev, stuck, gaps) => !green ? 'верификация после правки по саморевью не прошла'
  : !rev ? 'саморевьюер не вернул выход'
  : rev.status === 'blocked' ? `саморевью не выполнено: ${lack(rev, 'саморевьюер')}`
  : blockingOf(rev).length ? 'открытые P0/P1 после повторного саморевью'
  : stuck.length ? `прежние P0/P1 не закрыты: ${stuck.map(p => `${p.id || p.anchor} ${p.status} - ${p.evidence}`).join('; ')}` : gaps
// <<< shared: self-review
const REQ = { type: 'object', properties: {
  status: STATUS,
  requirements: { type: 'array', items: { type: 'string' }, description: 'единицы R/I с номером R1..Rn и источником файл:строка либо пометкой "допущение"; расхождение с разделом Контекст цели - строкой "расхождение с целью: ..."' },
  files: { type: 'array', items: { type: 'string' } },
  corpus: { type: 'string', description: 'найденный корпус документации проекта либо "корпуса нет"' },
  // Противоречие источников уезжало вниз строкой внутри requirements: трек читает у разведки
  // только status, и работа шла по стороне, выбранной узлом (зонд P23). Поле - enum, чтобы «нет
  // противоречий» отличалось от невыясненного, а не угадывалось по пустому перечню.
  'conflict-status': { type: 'string', enum: ['none', 'some'], description: 'противоречие между источниками о том, что считать готовым: none - нет, some - перечень в conflicts' },
  conflicts: { type: 'array', items: { type: 'string' }, description: 'при some - каждое противоречие строкой: якорь обеих сторон и что требует каждая; иначе пустой' },
  missing: { type: 'string', description: 'при blocked - чего не хватает и у кого это есть' },
}, required: ['status', 'requirements', 'files', 'corpus', 'conflict-status', 'conflicts', 'missing'] }
// Техконтекст отделён от разведки требований: он выводится из манифеста, а не из цели, и его узел
// готовит дерево - работа механическая и идёт параллельно чтению кода (обе стороны нужны только
// шагу 2, а холодное дерево иначе оплачивается временем кодера).
const PREP = { type: 'object', properties: {
  status: STATUS,
  stack: { type: 'string', description: 'идентификатор стека по реестру (Skill dex-skill-stack-registry:stack-registry); вне реестра - "other"' },
  stack_basis: { type: 'string', description: 'манифест, из которого выведен стек (путь:строка); манифеста нет - чем определено иначе' },
  test_cmd: { type: 'string', description: 'команда прогона тестов; нет тестов - пустая строка' },
  build_cmd: { type: 'string', description: 'команда сборки/типизации; нет - пустая строка' },
  prepare_cmd: { type: 'string', description: 'команда подготовки дерева до сборки (установка зависимостей по манифесту стека); зависимости ставит сама сборка либо их нет - пустая строка. Переиспользование готового из каталога сессии делает сама команда (копия или ссылка), иначе оно не происходит' },
  // Исход подготовки - enum: «дерево готово» и «готовить нечего» ведут к разному промпту кодера, а
  // провал установки, поданный пустой строкой, неотличим от успеха и всплывает только на сборке.
  'prepare-status': { type: 'string', enum: ['done', 'not-needed', 'failed'], description: 'done - команда выполнена и вернула 0; not-needed - prepare_cmd пуст; failed - команда упала либо не запущена' },
  prepare_log: { type: 'string', description: 'при done - код возврата и чем подтверждено; при failed - команда и последние строки вывода; при not-needed - почему готовить нечего' },
  missing: { type: 'string', description: 'при blocked - чего не хватает и у кого это есть' },
}, required: ['status', 'stack', 'stack_basis', 'test_cmd', 'build_cmd', 'prepare_cmd', 'prepare-status', 'prepare_log', 'missing'] }
const loops = { fix: 0, review_fix: 0, review: 0 }
const trail = [], degraded = []
const LEDGER = resuming ? ledgerList(A.open_findings, 'находки прошлого прогона кодеру не поданы') : []
const OPEN = LEDGER.length ? `\nНезакрытые находки прошлого прогона (из ledger): по каждой - запись в prior с тем же id: closed с уликой либо disputed с основанием, почему закрывать не следует:\n${LEDGER.map(priorLine).join('\n')}\n` : ''
let ctx = null, fix = null, fix2 = null, ver = null, ver2 = null
// Решения копятся по попыткам: fix перезаписывается каждым кругом, и без накопления в ledger уезжает только последний.
const decisions = []
const dec = () => decisions.slice()
const bail = (where, missing, extra) => outcome('blocked', where, missing, { decisions: dec(), ctx, fix, ...extra })
const passed = (v) => isGreen(v, ctx && ctx.test_cmd)

phase('Context')
// Разведка выводится из неизменного - цели, манифеста и кода, - поэтому при возобновлении берётся
// из ledger, а не покупается заново: повтор ещё и перевыводит номера R, на которые ссылаются
// находки прошлого прогона. Подготовка дерева из ledger не берётся ни при каком следе: дерево - это
// состояние, а не вывод, и запись «установлено» на холодном дереве трека ложна.
// Барьер здесь по существу: шаг 2 нуждается в обеих половинах, а порознь они выводятся из разного -
// требования из цели и кода, команды из манифеста.
// Поле возобновления кладёт главный поток из ledger, но подать он может что угодно: непроверенная
// форма роняла трек на первом же обращении к разведке (зонд P25). Непригодное поле трек не
// останавливает - разведка покупается узлом, а подмена названа оператору.
const ctxIn = fromLedger(A.ctx)
const ctxFormed = !!ctxIn && Array.isArray(ctxIn.requirements) && ctxIn.requirements.length > 0 && Array.isArray(ctxIn.files) && (ctxIn.conflicts === undefined || Array.isArray(ctxIn.conflicts))
// Неполная разведка прошлого прогона - не продукт: недостающее оператор даёт в источник, и «продолжить» выводит её заново, иначе разрыв повторялся бы каждым прогоном.
const ctxResumed = ctxFormed && ctxIn.status === 'complete' ? ctxIn : null
if (A.ctx && !ctxFormed) degraded.push('поле ctx подано не в форме разведки (нужны перечни requirements и files, conflicts - перечнем) - разведка выведена узлом заново')
else if (ctxFormed && !ctxResumed) decisions.push(`разведка прошлого прогона ${ctxIn.status || 'без статуса'} - выведена узлом заново`)
const [prep, req] = await parallel([
  () => node('подготовка дерева', `${PREP_HEAD}Шаг 1 (техконтекст и подготовка дерева). Стек - идентификатор по реестру: вызови Skill dex-skill-stack-registry:stack-registry и сопоставь с манифестом дерева; вне реестра - "other". Манифест, из которого вывел, назови в stack_basis - догадка по именам файлов не принимается. По тому же манифесту назови команды сборки и тестов. Дерево трека новое, зависимости в нём не установлены: назови команду подготовки и ВЫПОЛНИ её в дереве, prepare-status - по коду возврата (0 - done, иначе failed с командой и хвостом вывода; не запускал - тоже failed с причиной).${A.main_cwd ? ` Каталог сессии ${A.main_cwd} с готовыми зависимостями доступен на чтение - переиспользование оформляется самой командой (копия или ссылка).` : ''} Зависимости ставит сама сборка либо их нет - prepare_cmd пустой, prepare-status: not-needed с причиной в prepare_log. Ничего, кроме подготовки, в дереве не делай: код не правь, сборку и тесты не прогоняй - в этот момент то же дерево читает соседний узел.`,
    { label: 'ctx:tree', phase: 'Context', model: 'haiku', schema: PREP }),
  () => ctxResumed ? Promise.resolve(ctxResumed) : node('аналитик контекста', `${HEAD}${DONE}Шаг 1 (требования): R/I. Источник: ${A.source || 'формулировка цели выше'}; прочитай его, исходники и тесты. ${A.goal_path ? `Прочитай файл цели: раздел «Контекст» (файлы, корпус) сверь с кодом, не ищи заново; расхождение - строкой "расхождение с целью: ...".` : 'Поищи корпус документации проекта (docs/, README, ADR, CLAUDE.md) - нет, так и скажи.'} Верни R/I: каждая единица пронумерована R1..Rn, с источником файл:строка либо пометкой "допущение". ${A.source ? `Требования и критерии приёмки источника против критерия «готово» цели суди вызовом Skill dex-skill-requirement-quality:requirement-quality, раздел «Противоречие»: поднятое им расхождение - строкой conflicts с якорями обеих сторон и тем, что требует каждая, conflict-status: some.` : `Источника требований нет - критерий «готово» сверять не с чем: conflict-status: none, conflicts пустой.`} Расхождение о техконтексте (файлы, корпус) сюда не подпадает - оно идёт строкой "расхождение с целью: ..." в requirements. Стек, команды сборки и тестов не выводи - их даёт соседний узел по манифесту. Код не меняй, сборку и тесты не прогоняй: соседний узел в этот момент ставит в это дерево зависимости.`,
    { label: 'ctx:R-I', phase: 'Context', schema: REQ }, 'Explore'),
])
trail.push({ step: '1-tree', doer: 'подготовка дерева', status: prep ? prep.status : 'null', prepare: prep ? prep['prepare-status'] : null })
trail.push({ step: '1-req', doer: ctxResumed ? 'ledger (разведка прошлого прогона)' : 'Explore', status: req ? req.status : 'null' })
if (!prep || prep.status === 'blocked') return bail('Context: подготовка дерева', lack(prep, 'узел подготовки дерева'))
if (!req || req.status === 'blocked') return bail('Context', lack(req, 'узел контекста'))
if (!req.requirements.length) return bail('Context', 'разведка не вывела ни одной единицы R/I - реализовывать нечего')
if (prep.status === 'partial') degraded.push(`подготовка дерева partial: ${prep.missing || 'нехватка не названа'}`)
// Техконтекст свежий даже на возобновлении: ledger отдаёт разведку, команды и состояние дерева - узел
// этого прогона. Форма ctx общая - её же принимает ledger и подаёт обратно в A.ctx.
ctx = { ...req, stack: prep.stack, build_cmd: prep.build_cmd, test_cmd: prep.test_cmd, prepare_cmd: prep.prepare_cmd }
// Провал подготовки - не стоп: дерево лечит кодер первой попыткой, но знать о провале он обязан,
// иначе молча встанет на первой сборке и проест потолок.
if (prep['prepare-status'] === 'failed') degraded.push(`подготовка дерева не удалась: ${prep.prepare_log || 'причина не названа'}`)
// Выбор стороны в противоречии источников - полномочие владельца требований, не узла: узел, выбравший
// сторону, закрепляет её тестом и коммитом, и решение в пользу второй стоит инверсии теста (зонд P23).
// Перечень судится наравне со статусом: «none» при непустом перечне сам себя опровергает.
const conflicts = ctx.conflicts || []
// Разведку этот исход не переживает (ctx: null): решение владельца меняет источник, из которого она
// выведена, и поданная из ledger она встала бы на том же противоречии по уже исправленным документам.
if (ctx['conflict-status'] === 'some' || conflicts.length) return bail('Context', `противоречие источников требований, выбор стороны не за исполнителем: ${conflicts.join('; ') || 'перечень не назван при conflict-status: some'}`, { ctx: null })
const reqText = ctx.requirements.join('\n')
const coderType = CODER[ctx.stack]

phase('Implement')
// Фаза параметром: verify зовётся и из Review, а фаза берётся из opts, не из phase().
const verifyOnce = (tag, ph = 'Implement') => node('верификатор', `${HEAD}Верификация (${tag}): ТОЛЬКО прогон и отчёт, код не менять. Выполни ${ctx.build_cmd ? `сборку: ${ctx.build_cmd}; ` : ''}${ctx.test_cmd ? `тесты: ${ctx.test_cmd}` : 'тестов нет - build_ok по сборке, счётчики 0'}; затем ${VERIFY_CMDS}. Числа - из вывода раннера как есть.`,
  { label: `verify:${tag}`, phase: ph, model: 'haiku', schema: VERIFY })
// Зелёная верификация на цели без прошлого прогона значит «работа не покрыта тестами», а не «сделана»: молча пропустить правку по ней нельзя.
if (A.resume && !resuming) {
  log('«продолжить» без следа прошлого прогона в ledger: трек идёт как первый, фаза правки не пропускается')
  decisions.push('«продолжить» подано без trail: прогона по этой цели в ledger нет, возобновление не применено - трек отработал как первый')
}
// Возобновление начинается с верификации: зелёное дерево с коммитами не переделывается (ledger.md, «продолжить»).
if (resuming) {
  ver = await verifyOnce('возобновление')
  trail.push({ step: 'resume', doer: 'general-purpose', passed: passed(ver) })
  if (noRun(ver)) return bail('Implement: верификация при возобновлении', lack(ver, 'верификатор'))
}
// Зелёное дерево с незакрытыми находками прошлого прогона не выпускает трек мимо правки (ledger.md, «продолжить»);
// без коммитов трека - тоже: прошлый прогон встал до правки, и зелёные базовые тесты работу не подтверждают.
let pending = LEDGER.length > 0 || (resuming && !ver.ahead)
for (let k = 1; k <= FIX_CEILING && (!passed(ver) || pending); k++) {
  loops.fix = k; pending = false
  // red-run прошлой попытки - установленный факт: без него следующая попытка показывает тот же тест красным заново, проедая потолок.
  const priorRed = fix && fix['red-run'] && !/^(n\/a|unverifiable)/.test(fix['red-run']) ? `\nКрасный прогон уже показан прошлой попыткой и перепроверке не подлежит: ${fix['red-run']}` : ''
  const prev = ver && !passed(ver) ? `\n${k === 1 ? 'Верификация при возобновлении' : `Попытка ${k - 1}`} не прошла: ${redNote(ver)}. Дерево изолированное: это следствие правок трека, а не чужой работы.${priorRed}` : ''
  fix = await node('кодер', `${HEAD}${DONE}${OPEN}Шаг 2, попытка ${k} из ${FIX_CEILING}: реализация по требованиям, TDD (тесты на каждую R).\nТребования:\n${reqText}\nФайлы: ${ctx.files.join(', ')}. Тесты: ${ctx.test_cmd || 'нет'}. Сборка: ${ctx.build_cmd || 'нет'}.${prep['prepare-status'] === 'done' ? ` Дерево подготовлено узлом контекста (${ctx.prepare_cmd}) - установку не повторяй.` : prep['prepare-status'] === 'failed' ? ` Подготовка дерева узлом контекста не удалась (${prep.prepare_log || 'причина не названа'}) - до первой сборки выполни её сам: ${ctx.prepare_cmd || 'команда не названа, выведи по манифесту'}` : ''}${prev}\nПо завершении: сборка и тесты зелёные, коммит локально (сообщение по цели, без служебной нумерации R), push не делать.`,
    { label: `fix:${k}`, phase: 'Implement', schema: FIX }, coderType)
  trail.push({ step: 2, attempt: k, doer: coderType || 'general-purpose', status: fix ? fix.status : 'null', 'red-run': fix ? fix['red-run'] : null })
  if (fix) decisions.push(...said(fix))
  if (!fix || fix.status === 'blocked') return bail(`Implement#${k}`, lack(fix, 'узел-кодер'))
  ver = await verifyOnce(`после попытки ${k}`)
  trail.push({ step: '2-exit', attempt: k, doer: 'general-purpose', passed: passed(ver) })
  if (noRun(ver)) return bail(`Implement#${k}: верификация`, lack(ver, 'верификатор'))
  if (!passed(ver)) log(`попытка ${k}: exit=${ver && ver.exit_code}, build_ok=${ver && ver.build_ok}, fail=${ver && ver.fail_count}, dirty=${ver && ver.dirty}`)
}
if (!passed(ver)) return outcome('partial', `Implement: потолок ${FIX_CEILING} исчерпан`, `дерево не зелёное после ${FIX_CEILING} попыток: ${redNote(ver)}`, { ver, ctx, fix, decisions: dec() })

phase('Review')
const review = (tag, f, priors) => node('саморевьюер', `${HEAD}Шаг 3 (${tag}): pre-push саморевью локальной ветки - коммиты этой цели плюс рабочее дерево.${coderInput(f)} Источник намерения - требования:\n${reqText}${priors.length ? `\nПрежние находки - статус каждой в prior с тем же id и уликой; оставшаяся в коде идёт в prior, не в findings:\n${priors.map(priorLine).join('\n')}` : ''}\nПрогон build/test реальный, итог - в run-status, не в findings. Код не меняй.`,
  { label: `self-review:${tag}`, phase: 'Review', schema: REVIEW }, 'dex-self-reviewer:self-reviewer')
let rev = await review('первое', fix, LEDGER); loops.review = 1
let carried = []
trail.push({ step: 3, doer: 'self-reviewer', status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1, verdict: rev ? rev['review-verdict'] : null })
const reg = registry(UNSETTLED)
LEDGER.forEach(reg.doubt)
reg.apply(rev)
if (rev && rev.status !== 'blocked' && (blockingOf(rev).length || reg.blocking().length)) {
  loops.review_fix = REVIEW_FIX_CEILING
  fix2 = await node('кодер', `${HEAD}Шаг 2 (повтор после саморевью, потолок ${REVIEW_FIX_CEILING}): закрой находки:\n${[...reg.blocking(), ...blockingOf(rev)].map(priorLine).join('\n')}\nТребования:\n${reqText}\nПосле правки сборка и тесты зелёные, коммит локально, push не делать. По каждой находке - запись в prior с тем же id и anchor: closed с уликой либо disputed с основанием, почему закрывать не следует.`,
    { label: 'fix:after-review', phase: 'Review', schema: FIX }, coderType)
  ver2 = !fix2 || fix2.status === 'blocked' ? null : await verifyOnce('после саморевью', 'Review')
  trail.push({ step: '2-after-review', doer: coderType || 'general-purpose', status: fix2 ? fix2.status : 'null', passed: passed(ver2), 'red-run': fix2 ? fix2['red-run'] : null })
  if (fix2) decisions.push(...said(fix2))
  const openNow = { review: rev, open_findings: rev.findings, prior: reg.all() }
  if (!fix2 || fix2.status === 'blocked') return bail('Review: правка по находкам', lack(fix2, 'узел-кодер'), openNow)
  if (noRun(ver2)) return bail('Review: верификация после правки', lack(ver2, 'верификатор'), openNow)
  const rev1 = rev
  if (passed(ver2) && sealed(fix2) && [...reg.blocking(), ...blockingOf(rev1)].every(f => closedBy(fix2, f))) {
    loops.review = 1
    // Находка без своей строки решения - шаг не выполнен: снятая правкой идёт в decisions поимённо.
    const shut = [...reg.blocking(), ...blockingOf(rev1)]
    shut.forEach(f => {
      decisions.push(`${f.anchor}: ${SKIPPED}${f.closure ? `; критерий закрытия: ${f.closure}` : ''}`)
      reg.seat(f, 'closed', SKIPPED)
    })
    rev = { ...rev1, findings: rev1.findings.filter(f => !isBlocking(f)) }
    trail.push({ step: '3-repeat', doer: 'не куплено: правка замкнута и проверена прогоном', status: 'skipped', closed: shut.length })
  } else {
    const recheck = blockingOf(rev1).map(f => ({ id: '', anchor: f.anchor, severity: f.severity, axis: f.axis, text: f.text }))
    rev = await review('повторное', fix2, [...reg.open(), ...recheck]); loops.review = 2
    // Повторное ревью без выхода или blocked не закрывает находки первого: они остаются открытыми.
    if (!rev || rev.status === 'blocked') carried = blockingOf(rev1)
    else {
      // Находка первого ревью, названная повторным снова в findings, уже открыта там - второй записью в prior она задвоилась бы.
      recheck.filter(f => !rev.findings.some(n => same(n, f))).forEach(reg.doubt)
      reg.apply(rev)
    }
    trail.push({ step: '3-repeat', doer: 'self-reviewer', status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1, verdict: rev ? rev['review-verdict'] : null })
  }
}
const finalVer = ver2 || ver
const gap = authorGap(fix2 || fix)
const green = passed(finalVer)
const gaps = [ledgerUnread ? LEDGER_UNREAD : '', req.status === 'partial' ? `разведка требований неполна: ${req.missing || 'нехватка не названа'}` : '', !ctx.build_cmd && !ctx.test_cmd ? 'внешнего факта нет: ни сборки, ни тестов' : '', finalVer && !finalVer.ahead ? 'коммитов трека нет' : '', reviewGap(rev), gap].filter(Boolean).join('; ')
const open_findings = carried.length ? [...carried, ...(rev ? rev.findings : [])] : rev ? rev.findings : []
const where = admit(green, rev, reg.blocking(), gaps)
return outcome(where ? 'partial' : 'complete', where, where, {
  goal_check: { build_ok: !!finalVer && finalVer.build_ok, tests_green: !!finalVer && finalVer.exit_code === 0 && finalVer.fail_count === 0, committed: !!finalVer && !finalVer.dirty && finalVer.ahead > 0, head: finalVer ? finalVer.head : '' },
  ctx, fix, fix_after_review: fix2, review: rev, open_findings, prior: reg.all(),
  decisions: dec(),
})
