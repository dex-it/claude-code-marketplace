// Трек bugfix как Workflow-скрипт (artifacts.md, O12 вариант A). Ядро - debugger на воспроизведении и первопричине,
// фикс - кодер по стеку (коммит в его контракте, у debugger - нет). Модель находки, узел-обёртка, верификация и саморевью - общие фрагменты tracks-shared.
// Вход через args: { task, symptom, expected, env, done, boundary, mode, cwd, main_cwd, source, goal_path, resume, trail, open_findings, repro }.
export const meta = {
  name: 'dex-auto-bugfix',
  description: 'Трек bugfix: подготовка дерева -> воспроизведение и первопричина (debugger) -> фикс кодером с верификацией (потолок 3) -> саморевью -> правка по находкам (потолок 1)',
  phases: [
    { title: 'Context', detail: 'подготовка дерева по манифесту стека, команды сборки и тестов' },
    { title: 'Reproduce', detail: 'debugger: красный воспроизводящий тест либо прослеженный путь, первопричина, предложение фикса; продуктовый код не меняет' },
    { title: 'Fix', detail: 'кодер по стеку принимает диагноз и лечит первопричину x верификация внешним фактом, потолок 3; спор с диагнозом - к оператору, продолжение зовёт диагноста с уликой (фаза Reproduce); при возобновлении - сначала верификация' },
    { title: 'Review', detail: 'саморевью, при блокирующих находках одна правка с верификацией и повторное ревью' },
  ],
}

const A = args || {}
const FIX_CEILING = 3, REVIEW_FIX_CEILING = 1
// Дерево, стоп-линии и отсутствие оператора одинаковы для любого узла трека; симптом и критерий
// несёт только тот, кто их исполняет.
const TREE = `Работай только внутри ${A.cwd}: отдельное git worktree трека на ветке auto/${A.task}, чужой работы в нём нет - всё незакоммиченное и все падения сборки и тестов в нём от этой работы. Каждая команда Bash - в дереве (cd ${A.cwd} && ...) и без каталога сессии ни в одном звене, иначе хук отбивает её целиком; чужое читай Read и Grep.${A.main_cwd ? ` Каталог сессии ${A.main_cwd} - только чтение (готовые локальные зависимости).` : ''} Стоп-линия: push, деплой, миграции данных, удаление вне дерева. Оператора нет: невыводимое не додумывай - status: blocked, нехватка в missing.\n`
const HEAD = `mode: ${A.mode || 'autonomous'}\nцель (${A.task}): починить баг - симптом: ${A.symptom}\nожидаемое: ${A.expected || 'не задано - реконструируй из тестов и корпуса, назови основание'}\nокружение: ${A.env || 'не задано'}\nкритерий «готово»: ${A.done}\nграница: ${A.boundary || 'не выходить за рабочий каталог'}\nфайл цели: ${A.goal_path || 'нет'}\ndecision-log: n/a (трек журнал решений не ведёт; решения - полем decisions)\n${TREE}`
// Узел подготовки симптома не получает: прочитав его первой строкой, он чинит баг сам, и хвостовой
// запрет его не держит (зонд P25). Предмет узла - дерево, и шапка несёт только его.
const PREP_HEAD = `mode: ${A.mode || 'autonomous'}\nзадача (${A.task}): подготовить дерево трека к сборке и тестам - и только это: код не правь, баг не чини, тесты не гоняй - это делают следующие узлы.\n${TREE}`
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
  prior: { type: 'array', items: PRIOR, description: 'по каждой находке задания - запись с её id: closed - закрыта правкой, disputed - закрывать не следует; находок в задании нет - пусто' },
  missing: { type: 'string' },
}, required: ['status', 'diff-scope', 'commit', 'run-status', 'red-run', 'uncovered-status', 'uncovered', 'dependents-status', 'dependents', 'fact-check', 'decisions', 'prior', 'missing'] }
const REVIEW = { type: 'object', properties: {
  status: STATUS,
  findings: { type: 'array', items: FINDING, description: 'только находки, которых нет в перечне прежних' },
  'run-status': { type: 'string', description: 'прогон свой, не пересказ входа' },
  'red-run': { type: 'string', description: 'вердикт по записям red-run кодера во входе: по каждому тесту дельты запись действует / отсутствует / истекла; записей не было - unverifiable + что искал; тестов в дельте нет - n/a' },
  'fact-check': { type: 'string', description: 'предмет сверки - техутверждения находок' },
  intent: { type: 'string', description: 'сверка с источником намерения входа: соответствует / расхождения «корректно, но не то»; источника нет - n/a' },
  'intent-status': { type: 'string', enum: ['match', 'mismatch', 'n/a'], description: 'mismatch - сделано не то, чего требует источник намерения входа; подробности в intent' },
  prior: { type: 'array', items: PRIOR, description: 'по каждой находке перечня прежних - запись с её id, статус с уликой; перечня нет - пусто' },
  'review-verdict': { type: 'string', enum: ['APPROVE', 'REQUEST_CHANGES', 'NEEDS_DISCUSSION'], description: 'по правилу поля review-verdict из node-contract; сигнал оператору, порог допуска трека его не читает' },
  missing: { type: 'string', description: 'при blocked - чего не хватило для ревью; иначе пусто' },
}, required: ['status', 'findings', 'run-status', 'red-run', 'fact-check', 'intent', 'intent-status', 'prior', 'review-verdict', 'missing'] }
const UNSETTLED = 'статус саморевью не сверен'
const LISTED = 'Перечень находок: по каждой - запись в prior с её id, статус с уликой; находка перечня идёт только в prior, в findings - то, чего в перечне нет:'
// fix перезаписывается каждой попыткой: решения и оспаривание прежней находки без переноса в decisions до выхода не доезжают.
const said = (f) => [...(f.decisions || []), ...(f.prior || []).filter(p => p.status === 'disputed').map(p => `${p.id || p.anchor}: кодер оспорил закрытие - ${p.evidence}`)]
// Записи red-run и uncovered кодера - вход саморевьюера: он судит red-run по записям входа, а uncovered адресован следующему узлу.
const coderInput = (f) => f ? `\nВход от кодера - red-run: ${f['red-run']}\nuncovered: ${f['uncovered-status']}${(f.uncovered || []).length ? ' - ' + f.uncovered.join('; ') : ''}\ndependents: ${f['dependents-status']}${(f.dependents || []).length ? ' - ' + f.dependents.join('; ') : ''}` : ''
// Повторное ревью правке, целиком проверенной прогоном и не видимой наружу, нового факта не даёт (ledger: окупалось в 5 из 23); unknown и перечень при none пропуск не дают.
const sealed = (f) => f['uncovered-status'] === 'none' && (f.uncovered || []).length === 0 && f['dependents-status'] === 'none' && (f.dependents || []).length === 0
// Отказ кодера и его молчание - не закрытие.
const closedBy = (f, x) => ((f && f.prior) || []).some(p => p.id === x.id && p.status === 'closed')
const SKIPPED = 'закрыта правкой, повторное саморевью не куплено - правка покрыта прогоном (uncovered-status: none), наружу не видна (dependents-status: none), верификация зелёная'
// partial кодера и опровергнутая им сверка - исход автора: зелёная верификация и чистое ревью их не закрывают.
const authorGap = (f) => !f ? '' : f.status === 'partial' ? `кодер вернул partial: ${f.missing || f['run-status'] || 'нехватка не названа'}` : /^contradicted/.test(f['fact-check'] || '') ? `fact-check кодера: ${f['fact-check']}` : ''
const reviewGap = (r) => !r || r.status === 'blocked' ? '' : r.status === 'partial' ? `саморевью не завершено: ${r.missing || 'нехватка не названа'}` : r['intent-status'] === 'mismatch' ? `саморевью: реализовано не то: ${r.intent}` : ''
// Порог допуска: зелёная верификация и ноль открытых P0/P1 реестра прогона; review-verdict - сигнал оператору, порог его не читает.
const admit = (green, rev, stuck, gaps) => !green ? 'верификация после правки по саморевью не прошла'
  : !rev ? 'саморевьюер не вернул выход'
  : rev.status === 'blocked' ? `саморевью не выполнено: ${lack(rev, 'саморевьюер')}`
  : stuck.length ? `открытые P0/P1: ${stuck.map(p => `${p.id} ${p.status} - ${p.evidence}`).join('; ')}` : gaps
// <<< shared: self-review
const REPRO = { type: 'object', properties: {
  status: STATUS,
  root_cause: { type: 'string', description: 'первопричина с привязкой файл:строка, не симптом; не установлена (гейт первопричины, нужен runtime) - пусто, почему - в missing' },
  reproduction: { type: 'string', description: '"тест <имя>: красный, <вывод>, причина падения сверена" либо прослеженный путь от входа до места сбоя и почему без теста' },
  // Снимок теста - опора механической сверки: правку проверки кодером трек ловит сравнением хэшей, а не доверием к его отчёту.
  repro_test: { type: 'string', description: 'путь воспроизводящего теста, оставленного в дереве красным; теста нет - пусто' },
  repro_blob: { type: 'string', description: 'вывод git hash-object -w <путь теста> после его записи; теста нет - пусто' },
  'expected-basis': { type: 'string', description: 'откуда взято ожидаемое: вход, тест, корпус, реконструкция' },
  fix_proposal: { type: 'string', description: 'минимальная правка словами: файл, что меняется' },
  files: { type: 'array', items: { type: 'string' } },
  // Ожидаемое берётся из нескольких источников сразу, и они расходятся: вход цели против критерия
  // приёмки владельца в корпусе. Узел, выбравший сторону, чинит под неё и закрепляет тестом (зонд P23).
  'conflict-status': { type: 'string', enum: ['none', 'some'], description: 'противоречие между источниками ожидаемого: none - нет, some - перечень в conflicts' },
  conflicts: { type: 'array', items: { type: 'string' }, description: 'при some - каждое противоречие строкой: якорь обеих сторон и что требует каждая; иначе пустой' },
  missing: { type: 'string', description: 'при blocked - чего не хватает и у кого это есть' },
}, required: ['status', 'root_cause', 'reproduction', 'repro_test', 'repro_blob', 'expected-basis', 'fix_proposal', 'files', 'conflict-status', 'conflicts', 'missing'] }
// Техконтекст отделён от воспроизведения: он выводится из манифеста, а не из симптома. Параллели с
// диагностом здесь нет - воспроизведение требует подготовленного дерева, и два узла, одновременно
// ставящие зависимости и гоняющие тесты в одном дереве, портят прогон друг другу. Выигрыш другой:
// механическую работу ведёт дешёвый узел, а диагност получает команды готовыми.
const PREP = { type: 'object', properties: {
  status: STATUS,
  stack: { type: 'string', description: 'идентификатор стека по реестру (Skill dex-skill-stack-registry:stack-registry); вне реестра - "other"' },
  stack_basis: { type: 'string', description: 'манифест, из которого выведен стек (путь:строка); манифеста нет - чем определено иначе' },
  test_cmd: { type: 'string', description: 'команда прогона тестов; нет тестов - пустая строка' },
  build_cmd: { type: 'string', description: 'команда сборки/типизации; нет - пустая строка' },
  prepare_cmd: { type: 'string', description: 'команда подготовки дерева до сборки (установка зависимостей по манифесту стека); зависимости ставит сама сборка либо их нет - пустая строка.' },
  // Исход подготовки - enum: «дерево готово» и «готовить нечего» ведут к разному промпту дальше, а
  // провал установки, поданный пустой строкой, неотличим от успеха и всплывает только на прогоне.
  'prepare-status': { type: 'string', enum: ['done', 'not-needed', 'failed'], description: 'done - команда выполнена и вернула 0; not-needed - prepare_cmd пуст; failed - команда упала либо не запущена' },
  prepare_log: { type: 'string', description: 'при done - код возврата и чем подтверждено; при failed - команда и последние строки вывода; при not-needed - почему готовить нечего' },
  missing: { type: 'string', description: 'при blocked - чего не хватает и у кого это есть' },
}, required: ['status', 'stack', 'stack_basis', 'test_cmd', 'build_cmd', 'prepare_cmd', 'prepare-status', 'prepare_log', 'missing'] }
// Приёмка диагноза - часть контракта кодера только в этом треке: общая схема правки расширяется, а не копируется.
const BFIX = { type: 'object', properties: {
  ...FIX.properties,
  'red-run': { type: 'string', description: 'чем показан красным тест на этот дефект и сверенная причина падения; плюс по каждому существующему тесту, чью целевую ветку тронула правка; подпадающих тестов нет вовсе (теста на дефект нет и чужих целевых веток не трогал) - n/a с этой причиной; показать не вышло - unverifiable + чем пробовал' },
  'diagnosis-check': { type: 'string', enum: ['accepted', 'harness-fixed', 'disputed-test', 'disputed-cause', 'disputed-expected', 'n/a'] },
  dispute: { type: 'string' },
}, required: [...FIX.required, 'diagnosis-check', 'dispute'] }
const BVERIFY = { type: 'object', properties: {
  ...VERIFY.properties,
  repro_test_hash: { type: 'string', description: 'git hash-object <путь теста диагноста>; путь не назван - пусто; файла нет - "missing"' },
}, required: [...VERIFY.required, 'repro_test_hash'] }
const loops = { fix: 0, review_fix: 0, review: 0 }
const trail = [], degraded = []
const LEDGER = resuming ? ledgerList(A.open_findings, 'находки прошлого прогона кодеру не поданы') : []
const OPEN = LEDGER.length ? `\nНезакрытые находки прошлого прогона (из ledger): по каждой - запись в prior с тем же id: closed с уликой либо disputed с основанием, почему закрывать не следует:\n${LEDGER.map(priorLine).join('\n')}\n` : ''
let repro = null, fix = null, fix2 = null, ver = null, ver2 = null
const disputes = []
// Решения копятся по попыткам: fix перезаписывается каждым кругом, и без накопления в ledger уезжает только последний.
const decisions = []
const dec = () => decisions.slice()
const bail = (where, missing, extra) => outcome('blocked', where, missing, { decisions: dec(), repro, fix, ...extra })
const passed = (v) => isGreen(v, repro && repro.test_cmd)

phase('Context')
// Подготовка дерева из ledger не берётся ни при каком следе: дерево - это состояние, а не вывод, и
// запись «установлено» на холодном дереве трека ложна. Узел отдельный и дешёвый: работа механическая,
// а диагност дальше получает команды готовыми и тратит своё окно на первопричину.
const prep = await node('подготовка дерева', `${PREP_HEAD}Шаг 1 (техконтекст): стек определи по реестру - вызови Skill dex-skill-stack-registry:stack-registry и сопоставь с манифестом дерева; догадка по именам файлов не принимается. По тому же манифесту - команды сборки и тестов. Зависимости в новом дереве не установлены: команду подготовки выполни в дереве, не только назови.${A.main_cwd ? ` Готовые зависимости каталога сессии ${A.main_cwd} переиспользует только сама команда (копия или ссылка).` : ''}`,
  { label: 'ctx:tree', phase: 'Context', model: 'haiku', schema: PREP })
trail.push({ step: '1-tree', doer: 'подготовка дерева', status: prep ? prep.status : 'null', prepare: prep ? prep['prepare-status'] : null })
if (!prep || prep.status === 'blocked') return bail('Context: подготовка дерева', lack(prep, 'узел подготовки дерева'))
if (prep.status === 'partial') degraded.push(`подготовка дерева partial: ${prep.missing || 'нехватка не названа'}`)
// Провал подготовки - не стоп: дерево лечит следующий узел, но знать о провале он обязан, иначе
// примет падение установки за падение продукта и назовёт первопричиной его.
if (prep['prepare-status'] === 'failed') degraded.push(`подготовка дерева не удалась: ${prep.prepare_log || 'причина не названа'}`)
const treeState = prep['prepare-status'] === 'done' ? ` Дерево подготовлено узлом контекста (${prep.prepare_cmd}) - установку не повторяй.` : prep['prepare-status'] === 'failed' ? ` Подготовка дерева узлом контекста не удалась (${prep.prepare_log || 'причина не названа'}) - до первого прогона выполни её сам: ${prep.prepare_cmd || 'команда не названа, выведи по манифесту'}. Падение установки первопричиной бага не называй.` : ''

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

phase('Reproduce')
// Воспроизведение и первопричина - установленный факт прошлого прогона: при возобновлении правка
// уже наложена, и повторный прогон диагноста не столько дорог, сколько нечестен - симптома он
// может уже не увидеть. Нет записи в ledger - узел отрабатывает как в первом прогоне.
const diagPrompt = (dispute) => `${HEAD}${DONE}${DONE ? `Шаг 1 выполняется заново: ${dispute ? 'прошлый диагноз оспорен, улика ниже' : 'диагноза с причиной в ledger нет'}.\n` : ''}Шаг 1 (воспроизведение): первопричина. Источник: ${A.source || 'формулировка выше'}. ${A.goal_path ? 'Прочитай файл цели: раздел «Контекст» (файлы, корпус) сверь с кодом, не ищи заново.' : ''}Стек: ${prep.stack}. Тесты: ${prep.test_cmd || 'нет'}. Сборка: ${prep.build_cmd || 'нет'}.${treeState} Воспроизведи: красный тест через продуктовый путь, прогнанный и падающий по причине симптома, либо, если тест не ставится, прослеженный путь от входа до места сбоя. ${A.source ? `Критерии приёмки корпуса против ожидаемого во входе и критерия «готово» суди вызовом Skill dex-skill-requirement-quality:requirement-quality, раздел «Противоречие»; найденное - в conflicts.` : `Источника требований нет: conflict-status: none, conflicts пустой.`} Расхождение о техконтексте (файлы, команды сборки и тестов, корпус) сюда не подпадает. Продуктовый код не меняй; написанный тест оставь незакоммиченным в дереве. Незакоммиченный тест в дереве до твоего старта - след прошлого диагноза этой цели: падает по причине симптома - он и есть воспроизведение, иначе удали; сдаёшь один тест.${dispute ? `\nКодер оспорил твой диагноз ${ledgerRepro && ledgerRepro.accepted ? `после приёмки (diagnosis-check: ${ledgerRepro.accepted}): его правки по диагнозу - в коммитах ветки, улика судится на дереве с ними` : 'до правки'}, улика: ${dispute}\nЭто первое направление фальсификации: исход по улике - первой строкой reproduction (отбита - чем, файл:строка; сняла причину - новый диагноз).` : ''}`
const diag = reproResumed || await node('диагност первопричины', diagPrompt(priorDispute), { label: 'reproduce', phase: 'Reproduce', schema: REPRO }, 'dex-debugger:debugger')
trail.push({ step: '1-repro', doer: reproResumed ? 'ledger (воспроизведение прошлого прогона)' : 'debugger', status: diag ? diag.status : 'null' })
// Техконтекст свежий даже на возобновлении: ledger отдаёт диагноз, команды и состояние дерева - узел
// этого прогона. Форма repro общая - её же принимает ledger и подаёт обратно в A.repro.
// accepted - факт приёмки кодером, accepted_blob - ожидаемый хэш теста после неё, accepted_pending - снимок ещё не снят: живут в repro, чтобы пережить ledger;
// новый диагноз их сбрасывает.
const withCtx = (d) => ({ repro_test: '', repro_blob: '', ...d, dispute: '', accepted: d.accepted || '', accepted_blob: d.accepted_blob || '', accepted_pending: !!d.accepted_pending, stack: prep.stack, build_cmd: prep.build_cmd, test_cmd: prep.test_cmd, prepare_cmd: prep.prepare_cmd })
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
if (repro.repro_test && !repro.repro_blob) degraded.push(`тест диагноста ${repro.repro_test} назван без снимка (repro_blob пуст): правка теста хэшем не сверяется, удаление сверяется`)
const causeOf = (d) => `Первопричина: ${d.root_cause}\nВоспроизведение: ${d.reproduction}\nОснование ожидаемого: ${d['expected-basis']}\nПредложение фикса: ${d.fix_proposal}${d.repro_test ? `\nТест диагноста: ${d.repro_test}` : ''}`
const causeText = causeOf(repro)
// Правка теста диагноста ловится хэшем, а не отчётом кодера: проверку, подогнанную под свой фикс, отчёт не назовёт.
// Сигнал ревьюеру идёт против теста диагноста и на каждом круге заново: замороженный до фазы Review, он молчал бы о подмене в правке по находкам.
const touchedOrig = (v) => !!repro.repro_blob && !!v && v.repro_test_hash !== repro.repro_blob
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
  ? `Диагноз принят прошлой попыткой (diagnosis-check: ${repro.accepted}): приёмку не повторяй, diagnosis-check - ${repro.accepted}; ${repro.repro_test ? `правке нужна другая проверка - тест диагноста не трогай, diagnosis-check - disputed-* с уликой в dispute${expected() ? `; снимок приёмки - ${expected()}, сверяй с ним перед коммитом` : ''}` : 'теста диагноста нет - проба твоя, правь её по red-run'}. Порядок - Skill dex-skill-node-contract:node-contract, материал references/diagnosis-acceptance.md.`
  : 'До правки прими диагноз: вызови Skill dex-skill-node-contract:node-contract, материал references/diagnosis-acceptance.md; исход - diagnosis-check, улика спора - dispute.'
// Спор с диагнозом до и после приёмки идёт одним путём: «продолжить» зовёт диагноста с уликой; ожидаемое - за владельцем требований.
const disputeExit = (dc, f, where, extra) => {
  const clue = f.dispute || 'улика не названа'
  if (dc === 'disputed-expected') return bail(`${where}: спор об ожидаемом`, `кодер оспорил ожидаемое, выбор стороны за владельцем требований: ${clue}${testLeft(repro)}`, { disputes, repro: RESET, ...extra })
  return outcome('partial', `${where}: кодер оспорил диагноз (${dc})`, `решение оператора: «продолжить» вернёт диагноз диагносту с уликой - ${clue}${testLeft(repro)}`, { disputes, repro: { ...repro, dispute: clue }, fix, decisions: dec(), ...extra })
}
const coderType = CODER[repro.stack]

phase('Fix')
// Фаза параметром: verify зовётся и из Review, а фаза берётся из opts, не из phase().
const verifyOnce = (tag, ph = 'Fix') => node('верификатор', `${HEAD}Верификация (${tag}): ТОЛЬКО прогон и отчёт, код не менять. Выполни ${repro.build_cmd ? `сборку: ${repro.build_cmd}; ` : ''}${repro.test_cmd ? `тесты: ${repro.test_cmd}` : 'тестов нет - build_ok по сборке, счётчики 0'}; затем ${VERIFY_CMDS}${repro.repro_test ? `; git hash-object ${repro.repro_test} - в repro_test_hash` : '; repro_test_hash пустой'}. Числа - из вывода раннера как есть.`,
  { label: `verify:${tag}`, phase: ph, model: 'haiku', schema: BVERIFY })
// Зелёная верификация на цели без прошлого прогона значит «работа не покрыта тестами», а не «сделана»: молча пропустить правку по ней нельзя.
if (A.resume && !resuming) {
  log('«продолжить» без следа прошлого прогона в ledger: трек идёт как первый, фаза правки не пропускается')
  decisions.push('«продолжить» подано без trail: прогона по этой цели в ledger нет, возобновление не применено - трек отработал как первый')
}
// Возобновление начинается с верификации: зелёное дерево с коммитами не переделывается (ledger.md, «продолжить»).
if (resuming) {
  ver = await verifyOnce('возобновление')
  trail.push({ step: 'resume', doer: 'general-purpose', passed: passed(ver) })
  if (noRun(ver)) return bail('Fix: верификация при возобновлении', lack(ver, 'верификатор'))
  settle(ver)
}
// Зелёное дерево не выпускает трек мимо правки, если есть незакрытые находки прошлого прогона либо диагноз поставлен в этом прогоне: его ещё никто не правил.
// Без коммитов трека - тоже: прошлый прогон встал до правки, и зелёные базовые тесты работу не подтверждают.
let pending = LEDGER.length > 0 || (resuming && (!reproResumed || !ver.ahead))
for (let k = 1; k <= FIX_CEILING && (!passed(ver) || pending); k++) {
  loops.fix = k; pending = false
  // red-run прошлой попытки - установленный факт: без него следующая попытка показывает тот же тест красным заново, проедая потолок.
  const priorRed = fix && fix['red-run'] && !/^(n\/a|unverifiable)/.test(fix['red-run']) ? `\nКрасный прогон уже показан прошлой попыткой и перепроверке не подлежит: ${fix['red-run']}` : ''
  const prev = ver && !passed(ver) ? `\n${k === 1 ? 'Верификация при возобновлении' : `Попытка ${k - 1}`} не прошла: ${redNote(ver)}.${priorRed}` : ''
  fix = await node('кодер', `${HEAD}${DONE}${OPEN}Шаг 2, попытка ${k} из ${FIX_CEILING}: лечи первопричину, не симптом; один баг - один фикс, попутного рефакторинга нет.\n${causeText}\nФайлы: ${repro.files.join(', ')}. Тесты: ${repro.test_cmd || 'нет'}. Сборка: ${repro.build_cmd || 'нет'}.${treeState}${prev}\n${acceptance()} Red-run: тест диагноста - твоя проба, в коммит; теста нет - пишешь свой. По завершении: сборка и тесты зелёные, коммит локально (сообщение по симптому).`,
    { label: `fix:${k}`, phase: 'Fix', schema: BFIX }, coderType)
  trail.push({ step: 2, attempt: k, doer: coderType || 'general-purpose', status: fix ? fix.status : 'null', 'red-run': fix ? fix['red-run'] : null, 'diagnosis-check': fix ? fix['diagnosis-check'] : null })
  if (fix) decisions.push(...said(fix))
  // Спор идёт раньше статуса: при нём кодер отдаёт partial без правки.
  const dc = noteCheck(fix)
  if (/^disputed-/.test(dc)) {
    disputes.push(`${dc} (попытка ${k}): ${fix.dispute || 'улика не названа'}`)
    return disputeExit(dc, fix, `Fix#${k}`)
  }
  if (!fix || fix.status === 'blocked') return bail(`Fix#${k}`, lack(fix, 'узел-кодер'))
  ver = await verifyOnce(`после попытки ${k}`)
  settle(ver)
  trail.push({ step: '2-exit', attempt: k, doer: 'general-purpose', passed: passed(ver) })
  if (noRun(ver)) return bail(`Fix#${k}: верификация`, lack(ver, 'верификатор'))
  if (!passed(ver)) log(`попытка ${k}: exit=${ver && ver.exit_code}, build_ok=${ver && ver.build_ok}, fail=${ver && ver.fail_count}, dirty=${ver && ver.dirty}`)
}
if (!passed(ver)) return outcome('partial', `Fix: потолок ${FIX_CEILING} исчерпан`, `дерево не зелёное после ${FIX_CEILING} попыток: ${redNote(ver)}`, { ver, repro, fix, decisions: dec() })
phase('Review')
const review = (tag, f, v, priors) => node('саморевьюер', `${HEAD}Шаг 3 (${tag}): pre-push саморевью локальной ветки - коммиты этой цели плюс рабочее дерево.${touchedOrig(v) ? `\nТест диагноста ${repro.repro_test} изменён кодером: исходник - git show ${repro.repro_blob}. Изменена проверка - вход, вызываемый путь или ожидаемое - находка P1.` : ''}${coderInput(f)} Источник намерения:\n${causeText}${priors.length ? `\n${LISTED}\n${priors.map(priorLine).join('\n')}` : ''}\nПрогон build/test реальный, итог - в run-status, не в findings. Код не меняй.`,
  { label: `self-review:${tag}`, phase: 'Review', schema: REVIEW }, 'dex-self-reviewer:self-reviewer')
let rev = await review('первое', fix, ver, LEDGER); loops.review = 1
trail.push({ step: 3, doer: 'self-reviewer', status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1, verdict: rev ? rev['review-verdict'] : null })
const reg = registry(UNSETTLED)
LEDGER.forEach(reg.doubt)
reg.apply(rev, 'саморевьюер')
if (rev && rev.status !== 'blocked' && reg.blocking().length) {
  loops.review_fix = REVIEW_FIX_CEILING
  fix2 = await node('кодер', `${HEAD}Шаг 2 (повтор после саморевью, потолок ${REVIEW_FIX_CEILING}): закрой находки:\n${reg.blocking().map(priorLine).join('\n')}\n${causeText}\n${acceptance()}\nПосле правки сборка и тесты зелёные, коммит локально, push не делать. По каждой находке - запись в prior с её id: closed с уликой либо disputed с основанием, почему закрывать не следует.`,
    { label: 'fix:after-review', phase: 'Review', schema: BFIX }, coderType)
  const dc2 = noteCheck(fix2)
  if (fix2) decisions.push(...said(fix2))
  if (/^disputed-/.test(dc2)) {
    trail.push({ step: '2-after-review', doer: coderType || 'general-purpose', status: fix2.status, 'diagnosis-check': dc2 })
    disputes.push(`${dc2} (правка по находкам): ${fix2.dispute || 'улика не названа'}`)
    return disputeExit(dc2, fix2, 'Review: правка по находкам', { fix_after_review: fix2, review: rev, prior: reg.all() })
  }
  ver2 = !fix2 || fix2.status === 'blocked' ? null : await verifyOnce('после саморевью', 'Review')
  settle(ver2)
  trail.push({ step: '2-after-review', doer: coderType || 'general-purpose', status: fix2 ? fix2.status : 'null', passed: passed(ver2), 'red-run': fix2 ? fix2['red-run'] : null })
  const openNow = { review: rev, prior: reg.all() }
  if (!fix2 || fix2.status === 'blocked') return bail('Review: правка по находкам', lack(fix2, 'узел-кодер'), openNow)
  if (noRun(ver2)) return bail('Review: верификация после правки', lack(ver2, 'верификатор'), openNow)
  // Правку теста после harness-fixed гейт отдаёт ревью: сменивший хэш круг повторное ревью не пропускает.
  if (passed(ver2) && sealed(fix2) && ver2.repro_test_hash === ver.repro_test_hash && reg.blocking().every(f => closedBy(fix2, f))) {
    // Находка без своей строки решения - шаг не выполнен: снятая правкой идёт в decisions поимённо.
    const shut = reg.blocking()
    shut.forEach(f => {
      decisions.push(`${f.id} ${f.anchor}: ${SKIPPED}${f.closure ? `; критерий закрытия: ${f.closure}` : ''}`)
      reg.seat(f, 'closed', SKIPPED)
    })
    trail.push({ step: '3-repeat', doer: 'не куплено: правка замкнута и проверена прогоном', status: 'skipped', closed: shut.length })
  } else {
    const listed = reg.open()
    rev = await review('повторное', fix2, ver2, listed); loops.review = 2
    // Повторное без выхода или blocked статусов не выносит: реестр остаётся, каким его оставило первое.
    if (rev && rev.status !== 'blocked') listed.forEach(reg.doubt)
    reg.apply(rev, 'саморевьюер (повторное)', listed)
    trail.push({ step: '3-repeat', doer: 'self-reviewer', status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1, verdict: rev ? rev['review-verdict'] : null })
  }
}
const finalVer = ver2 || ver
// Удалённый тест - разрыв при любой приёмке и без снимка: путь верификатору назван треком. Правка теста - против ожидания,
// а не вердикта: суждение «обвязка или проверка» ревью несёт на круге приёмки, дальше тест держится снимком.
// Тест в диагнозе, а правка прошла без записанной приёмки (n/a при тесте) - тоже разрыв.
const testGap = testMissing(finalVer) ? `тест диагноста ${repro.repro_test} удалён (repro_test_hash: ${hashOf(finalVer) || 'пусто'})`
  : !!expected() && finalVer.repro_test_hash !== expected() ? `тест диагноста ${repro.repro_test} изменён при diagnosis-check: ${((fix2 || fix) || {})['diagnosis-check'] || repro.accepted || 'не назван'}`
  : fix && repro.repro_test && !repro.accepted ? `приёмка диагноза не проведена: diagnosis-check ${(fix2 || fix)['diagnosis-check'] || 'не назван'} при тесте диагноста ${repro.repro_test}` : ''
const gap = [ledgerUnread ? LEDGER_UNREAD : '', authorGap(fix2 || fix) || testGap || (repro.status === 'partial' ? `воспроизведение partial: ${repro.missing || `эталон - ${repro['expected-basis']}`}` : ''),
  !repro.build_cmd && !repro.test_cmd ? 'внешнего факта нет: ни сборки, ни тестов' : '', !finalVer.ahead ? 'коммитов трека нет' : '', reviewGap(rev)].filter(Boolean).join('; ')
const green = passed(finalVer)
const where = admit(green, rev, reg.blocking(), gap)
return outcome(where ? 'partial' : 'complete', where, where, {
  goal_check: { build_ok: finalVer.build_ok, tests_green: finalVer.exit_code === 0 && finalVer.fail_count === 0, committed: !finalVer.dirty && finalVer.ahead > 0, head: finalVer.head },
  repro, fix, fix_after_review: fix2, review: rev, prior: reg.all(), disputes,
  decisions: dec(),
})
