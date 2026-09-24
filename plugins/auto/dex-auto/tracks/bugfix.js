// Трек bugfix как Workflow-скрипт (artifacts.md, O12 вариант A). Ядро - debugger на воспроизведении и первопричине,
// фикс - кодер по стеку (коммит в его контракте, у debugger - нет). Узел-обёртка, верификация и саморевью - как в feature.js.
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

const STATUS = { type: 'string', enum: ['complete', 'blocked', 'partial'] }
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
const SEV = { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'], description: 'уровень словаря node-contract: P0 = CRITICAL, P1 = HIGH, P2 = MEDIUM, P3 = LOW' }
// Прежняя находка опознаётся по id реестра ledger: без него finish.sh заводит её новой, и разность «открытые» двоится.
const PRIOR = { type: 'object', properties: {
  id: { type: 'string', description: 'id из перечня прежних находок; у находки без id - пусто' }, anchor: { type: 'string' }, severity: SEV, text: { type: 'string' },
  status: { type: 'string', enum: ['closed', 'partial', 'open', 'disputed', 'no-longer-applicable'] }, evidence: { type: 'string' },
}, required: ['id', 'anchor', 'severity', 'text', 'status', 'evidence'] }
// Ключи - имена словаря node-contract буквально: трансляция - место тихого расхождения схемы и
// словаря, а описание поля снято в пользу дома и резолвится только дословным ключом.
const FIX = { type: 'object', properties: {
  status: STATUS,
  'diff-scope': { type: 'array', items: { type: 'string' } },
  commit: { type: 'string', description: 'sha локального коммита либо пусто' },
  'run-status': { type: 'string' },
  'red-run': { type: 'string', description: 'чем показан красным тест на этот дефект и сверенная причина падения; плюс по каждому существующему тесту, чью целевую ветку тронула правка; подпадающих тестов нет вовсе (теста на дефект нет и чужих целевых веток не трогал) - n/a с этой причиной; показать не вышло - unverifiable + чем пробовал' },
  // Признак замкнутости - enum, а не слово в свободной строке: строку модель отдаёт синонимами
  // («none», «отсутствуют», «-»), и разбор превращается в угадывание, а пустое значение
  // неотличимо от невыясненного. Ветка «не выяснено» - законный терминал, не молчание.
  'uncovered-status': { type: 'string', enum: ['none', 'some', 'unknown'], description: 'осталось ли непокрытое тестами: none - не осталось, some - перечень в uncovered, unknown - покрытие не выяснялось; догадка сюда не пишется' },
  uncovered: { type: 'array', items: { type: 'string' }, description: 'при some - непокрытое перечнем (ветка, случай, граница); иначе пустой' },
  'dependents-status': { type: 'string', enum: ['none', 'some', 'unknown'], description: 'видно ли правку за пределами diff-scope: вызывающий код, контракт на проводе, схема данных, публичный API. none - не видно, some - видно (перечень в dependents), unknown - не разобрался; догадка сюда не пишется' },
  dependents: { type: 'array', items: { type: 'string' }, description: 'при some - потребители перечнем file:line; иначе пустой' },
  'fact-check': { type: 'string', description: 'триггер сверки - сигнатура или поведение стороннего API, взятые по памяти' },
  decisions: { type: 'array', items: { type: 'string' }, description: 'каждая закрытая узлом развилка: что выбрано, из чего, почему' },
  'diagnosis-check': { type: 'string', enum: ['accepted', 'harness-fixed', 'disputed-test', 'disputed-cause', 'disputed-expected', 'n/a'] },
  dispute: { type: 'string' },
  prior: { type: 'array', items: PRIOR, description: 'по каждой находке из задания - статус с уликой: closed - закрыта правкой, disputed - закрывать не следует; находок в задании нет - пусто' },
  missing: { type: 'string' },
}, required: ['status', 'diff-scope', 'commit', 'run-status', 'red-run', 'uncovered-status', 'uncovered', 'dependents-status', 'dependents', 'fact-check', 'decisions', 'diagnosis-check', 'dispute', 'prior', 'missing'] }
const VERIFY = { type: 'object', properties: {
  status: STATUS,
  exit_code: { type: 'integer' }, pass_count: { type: 'integer' }, fail_count: { type: 'integer' },
  failing: { type: 'array', items: { type: 'string' } },
  build_ok: { type: 'boolean' },
  head: { type: 'string', description: 'git log --oneline -3' },
  dirty: { type: 'boolean', description: 'git status --porcelain непустой' },
  ahead: { type: 'integer', description: 'коммитов ветки трека, которых нет ни на одной другой ветке' },
  repro_test_hash: { type: 'string', description: 'git hash-object <путь теста диагноста>; путь не назван - пусто; файла нет - "missing"' },
  missing: { type: 'string', description: 'при blocked - почему прогон не выполнен; иначе пусто' },
}, required: ['status', 'exit_code', 'pass_count', 'fail_count', 'failing', 'build_ok', 'head', 'dirty', 'ahead', 'repro_test_hash', 'missing'] }
const REVIEW = { type: 'object', properties: {
  status: STATUS,
  findings: { type: 'array', items: { type: 'object', properties: {
    severity: SEV, anchor: { type: 'string' }, text: { type: 'string' },
    closure: { type: 'string' },
  }, required: ['severity', 'anchor', 'text', 'closure'] } },
  'run-status': { type: 'string', description: 'прогон свой, не пересказ входа' },
  'red-run': { type: 'string', description: 'вердикт по записям red-run кодера во входе: по каждому тесту дельты запись действует / отсутствует / истекла; записей не было - unverifiable + что искал; тестов в дельте нет - n/a' },
  'fact-check': { type: 'string', description: 'предмет сверки - техутверждения находок' },
  intent: { type: 'string', description: 'сверка с требованиями входа: соответствует / расхождения «корректно, но не то»; источника намерения нет - n/a' },
  'intent-status': { type: 'string', enum: ['match', 'mismatch', 'n/a'], description: 'mismatch - починено не то, что требует первопричина и ожидаемое входа; подробности в intent' },
  prior: { type: 'array', items: PRIOR, description: 'по каждой прежней находке входа - статус с уликой; прежних нет - пусто' },
  'review-verdict': { type: 'string', enum: ['APPROVE', 'REQUEST_CHANGES', 'NEEDS_DISCUSSION'], description: 'по правилу поля review-verdict из node-contract; сигнал оператору, порог допуска трека его не читает' },
  missing: { type: 'string', description: 'при blocked - чего не хватило для ревью; иначе пусто' },
}, required: ['status', 'findings', 'run-status', 'red-run', 'fact-check', 'intent', 'intent-status', 'prior', 'review-verdict', 'missing'] }

const CODER = { ts: 'dex-ts-fullstack-coder:ts-fullstack-assistant', dotnet: 'dex-dotnet-coder:dotnet-coder' }
const loops = { fix: 0, review_fix: 0, review: 0 }
const trail = [], degraded = []
// Поля возобновления ledger.py печатает строкой JSON, а главный поток подаёт их как есть либо разобранными.
const fromLedger = (v) => { if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch (e) { return null } }
// Непригодный реестр прогон не останавливает: записи ledger без события этого прогона остаются открытыми сами.
// Но и complete он не выпускает: открытые P0/P1 реестра трек не видел, и «нет» о них не судится.
let ledgerUnread = false
const LEDGER = (() => {
  const v = A.open_findings
  if (!resuming || v === undefined || v === null || v === '') return []
  const list = fromLedger(v)
  if (!Array.isArray(list)) { ledgerUnread = true; degraded.push('поле open_findings не JSON-массив реестра ledger - находки прошлого прогона кодеру не поданы'); return [] }
  return list.filter(f => f && typeof f === 'object')
})()
const priorLine = (p) => `- ${p.id ? `${p.id} ` : ''}[${p.severity}] ${p.anchor}: ${p.text}`
const OPEN = LEDGER.length ? `\nНезакрытые находки прошлого прогона (из ledger): по каждой - запись в prior с тем же id: closed с уликой либо disputed с основанием, почему закрывать не следует:\n${LEDGER.map(priorLine).join('\n')}\n` : ''
let repro = null, fix = null, fix2 = null, ver = null, ver2 = null
const disputes = []
// Решения копятся по попыткам: fix перезаписывается каждым кругом, и без накопления в ledger уезжает только последний.
const decisions = []
const dec = () => decisions.slice()
// fix перезаписывается каждой попыткой: оспаривание прежней находки без переноса в decisions до выхода не доезжает.
const said = (f) => [...(f.decisions || []), ...(f.prior || []).filter(p => p.status === 'disputed').map(p => `${p.id || p.anchor}: кодер оспорил закрытие - ${p.evidence}`)]
const bail = (where, missing, extra) => ({ status: 'blocked', where, missing: missing || `${where}: узел вернул blocked без нехватки`, loops, trail, degraded, decisions: dec(), repro, fix, ...extra })
// Верификатор, не сумевший прогнать, по exit_code неотличим от красных тестов: без этой ветки трек проедает потолок правок вхолостую.
const noRun = (v) => !v || v.status === 'blocked'
const lack = (v) => !v ? 'верификатор не вернул выход' : v.missing || 'верификатор вернул blocked, нехватку не назвал'
// Узел каталога может быть не установлен: тогда general-purpose с ролью в промпте, факт - в degraded (graceful degradation).
async function node(role, prompt, opts, type) {
  if (type) {
    try { const r = await agent(prompt, { ...opts, agentType: type }); return r }
    catch (e) {
      // Причина обрыва платформой не типизирована: узел мог не существовать, а мог упасть посреди работы. Замена получает причину и сверяет уже сделанное.
      const why = String(e && e.message || e).slice(0, 300)
      degraded.push(`${role}: ${type} не отработал (${why})`); log(`узел ${type} не отработал, general-purpose`)
      // Замена - не узел каталога: норм полей выхода у неё нет, а схема их больше не пересказывает.
      return agent(`Роль: ${role}.\nУзел ${type} на этом шаге оборвался ошибкой: ${why}. Прежде чем действовать, сверь git log и рабочее дерево: сделанное им не повторяй и не коммить второй раз.\nНормы полей выхода (run-status, red-run, fact-check, uncovered, diff-scope, статусы ухода от проверки) у тебя не загружены: вызови Skill dex-skill-node-contract:node-contract до работы и заполняй по ним.\n${prompt}`, { ...opts, agentType: 'general-purpose' })
    }
  }
  return agent(`Роль: ${role}.\n${prompt}`, { ...opts, agentType: 'general-purpose' })
}
// exit 0 при упавших тестах даёт конвейер в команде раннера; ноль прошедших при команде тестов - прогон, не бывший прогоном тестов.
const isGreen = (v) => !!v && v.exit_code === 0 && v.fail_count === 0 && v.build_ok && !v.dirty && !(repro && repro.test_cmd && v.pass_count === 0)

phase('Context')
// Подготовка дерева из ledger не берётся ни при каком следе: дерево - это состояние, а не вывод, и
// запись «установлено» на холодном дереве трека ложна. Узел отдельный и дешёвый: работа механическая,
// а диагност дальше получает команды готовыми и тратит своё окно на первопричину.
const prep = await node('подготовка дерева', `${PREP_HEAD}Шаг 1 (техконтекст): стек определи по реестру - вызови Skill dex-skill-stack-registry:stack-registry и сопоставь с манифестом дерева; догадка по именам файлов не принимается. По тому же манифесту - команды сборки и тестов. Зависимости в новом дереве не установлены: команду подготовки выполни в дереве, не только назови.${A.main_cwd ? ` Готовые зависимости каталога сессии ${A.main_cwd} переиспользует только сама команда (копия или ссылка).` : ''}`,
  { label: 'ctx:tree', phase: 'Context', model: 'haiku', schema: PREP })
trail.push({ step: '1-tree', doer: 'подготовка дерева', status: prep ? prep.status : 'null', prepare: prep ? prep['prepare-status'] : null })
if (!prep || prep.status === 'blocked') return bail('Context: подготовка дерева', prep ? prep.missing : 'узел подготовки дерева не вернул выход')
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
// accepted - факт приёмки кодером, accepted_blob - ожидаемый хэш теста после неё: живут в repro, чтобы пережить ledger;
// новый диагноз их сбрасывает.
const withCtx = (d) => ({ repro_test: '', repro_blob: '', ...d, dispute: '', accepted: d.accepted || '', accepted_blob: d.accepted_blob || '', stack: prep.stack, build_cmd: prep.build_cmd, test_cmd: prep.test_cmd, prepare_cmd: prep.prepare_cmd })
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
const noCause = (d, where) => ({ status: 'partial', where, missing: (d.missing || 'диагност не назвал, чего не хватило') + testLeft(d), repro: { ...withCtx(d), ...(priorDispute ? { dispute: ledgerRepro.dispute, accepted: ledgerRepro.accepted || '', accepted_blob: ledgerRepro.accepted_blob || '' } : {}) }, disputes, loops, trail, degraded, decisions: dec() })
if (!diag || diag.status === 'blocked') return bail('Reproduce', diag ? (diag.missing || 'диагност вернул blocked без нехватки') + testLeft(diag) : 'узел воспроизведения не вернул выход')
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
let firstCheck = repro.accepted, harnessRound = false
const noteCheck = (f) => {
  const dc = f && f['diagnosis-check'] || ''
  const first = !firstCheck && !!dc
  if (first) firstCheck = dc
  // n/a - исход «теста в диагнозе нет»: при тесте в диагнозе приёмкой он не считается.
  if (!repro.accepted && dc && !/^disputed-/.test(dc) && !(dc === 'n/a' && repro.repro_test)) { repro.accepted = dc; harnessRound = first && dc === 'harness-fixed' }
  return dc
}
// Хэш - шестнадцатеричная строка; любой иной ответ верификатора (пусто, missing, текст ошибки git) - файла нет.
const hashOf = (v) => String(v && v.repro_test_hash || '').trim()
const testMissing = (v) => !!repro.repro_test && !/^[0-9a-f]+$/i.test(hashOf(v))
// Гейт судит против ожидания: снимок диагноста, а после harness-fixed первым исходом - хэш верификации этого круга.
// Сдвигает ожидание только круг приёмки, в прогоне: запись без верификации (обрыв кодера) оставляет снимок диагноста.
const settle = (v) => { if (harnessRound && v && !testMissing(v)) repro.accepted_blob = hashOf(v); harnessRound = false }
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
  return { status: 'partial', where: `${where}: кодер оспорил диагноз (${dc})`, missing: `решение оператора: «продолжить» вернёт диагноз диагносту с уликой - ${clue}${testLeft(repro)}`, disputes, repro: { ...repro, dispute: clue }, fix, loops, trail, degraded, decisions: dec(), ...extra }
}
const coderType = CODER[repro.stack]

phase('Fix')
// Фаза параметром: verify зовётся и из Review, а фаза берётся из opts, не из phase().
const verifyOnce = (tag, ph = 'Fix') => node('верификатор', `${HEAD}Верификация (${tag}): ТОЛЬКО прогон и отчёт, код не менять. Выполни ${repro.build_cmd ? `сборку: ${repro.build_cmd}; ` : ''}${repro.test_cmd ? `тесты: ${repro.test_cmd}` : 'тестов нет - build_ok по сборке, счётчики 0'}; затем git log --oneline -3, git status --porcelain и git rev-list --count HEAD --not --exclude="$(git branch --show-current)" --branches (это ahead)${repro.repro_test ? `; git hash-object ${repro.repro_test} - в repro_test_hash` : '; repro_test_hash пустой'}. Числа - из вывода раннера как есть.`,
  { label: `verify:${tag}`, phase: ph, model: 'haiku', schema: VERIFY })
// Зелёная верификация на цели без прошлого прогона значит «работа не покрыта тестами», а не «сделана»: молча пропустить правку по ней нельзя.
if (A.resume && !resuming) {
  log('«продолжить» без следа прошлого прогона в ledger: трек идёт как первый, фаза правки не пропускается')
  decisions.push('«продолжить» подано без trail: прогона по этой цели в ledger нет, возобновление не применено - трек отработал как первый')
}
// Возобновление начинается с верификации: зелёное дерево с коммитами не переделывается (ledger.md, «продолжить»).
if (resuming) {
  ver = await verifyOnce('возобновление')
  trail.push({ step: 'resume', doer: 'general-purpose', passed: isGreen(ver) })
  if (noRun(ver)) return bail('Fix: верификация при возобновлении', lack(ver))
}
// Зелёное дерево не выпускает трек мимо правки, если есть незакрытые находки прошлого прогона либо диагноз поставлен в этом прогоне: его ещё никто не правил.
// Без коммитов трека - тоже: прошлый прогон встал до правки, и зелёные базовые тесты работу не подтверждают.
let pending = LEDGER.length > 0 || (resuming && (!reproResumed || !ver.ahead))
for (let k = 1; k <= FIX_CEILING && (!isGreen(ver) || pending); k++) {
  loops.fix = k; pending = false
  // red-run прошлой попытки - установленный факт: без него следующая попытка показывает тот же тест красным заново, проедая потолок.
  const priorRed = fix && fix['red-run'] && !/^(n\/a|unverifiable)/.test(fix['red-run']) ? `\nКрасный прогон уже показан прошлой попыткой и перепроверке не подлежит: ${fix['red-run']}` : ''
  const prev = ver && !isGreen(ver) ? `\n${k === 1 ? 'Верификация при возобновлении' : `Попытка ${k - 1}`} не прошла: exit=${ver.exit_code}, build_ok=${ver.build_ok}, прошло тестов: ${ver.pass_count}, падают: ${ver.failing.join('; ') || 'нет'}, dirty=${ver.dirty}.${priorRed}` : ''
  fix = await node('кодер', `${HEAD}${DONE}${OPEN}Шаг 2, попытка ${k} из ${FIX_CEILING}: лечи первопричину, не симптом; один баг - один фикс, попутного рефакторинга нет.\n${causeText}\nФайлы: ${repro.files.join(', ')}. Тесты: ${repro.test_cmd || 'нет'}. Сборка: ${repro.build_cmd || 'нет'}.${treeState}${prev}\n${acceptance()} Red-run: тест диагноста - твоя проба, в коммит; теста нет - пишешь свой. По завершении: сборка и тесты зелёные, коммит локально (сообщение по симптому).`,
    { label: `fix:${k}`, phase: 'Fix', schema: FIX }, coderType)
  trail.push({ step: 2, attempt: k, doer: coderType || 'general-purpose', status: fix ? fix.status : 'null', 'red-run': fix ? fix['red-run'] : null, 'diagnosis-check': fix ? fix['diagnosis-check'] : null })
  if (fix) decisions.push(...said(fix))
  // Спор идёт раньше статуса: при нём кодер отдаёт partial без правки.
  const dc = noteCheck(fix)
  if (/^disputed-/.test(dc)) {
    disputes.push(`${dc} (попытка ${k}): ${fix.dispute || 'улика не названа'}`)
    return disputeExit(dc, fix, `Fix#${k}`)
  }
  if (!fix || fix.status === 'blocked') return bail(`Fix#${k}`, fix ? fix.missing : 'узел-кодер не вернул выход')
  ver = await verifyOnce(`после попытки ${k}`)
  settle(ver)
  trail.push({ step: '2-exit', attempt: k, doer: 'general-purpose', passed: isGreen(ver) })
  if (noRun(ver)) return bail(`Fix#${k}: верификация`, lack(ver))
  if (!isGreen(ver)) log(`попытка ${k}: exit=${ver && ver.exit_code}, build_ok=${ver && ver.build_ok}, fail=${ver && ver.fail_count}, dirty=${ver && ver.dirty}`)
}
if (!isGreen(ver)) return { status: 'partial', where: `Fix: потолок ${FIX_CEILING} исчерпан`, missing: `дерево не зелёное после ${FIX_CEILING} попыток: exit=${ver.exit_code}, build_ok=${ver.build_ok}, падают: ${ver.failing.join('; ') || 'нет'}, dirty=${ver.dirty}`, ver, repro, fix, loops, trail, degraded, decisions: dec() }
phase('Review')
// Записи red-run и uncovered кодера - вход саморевьюера: он судит red-run по записям входа, а uncovered адресован следующему узлу.
const review = (tag, f, v, priors) => node('саморевьюер', `${HEAD}Шаг 3 (${tag}): pre-push саморевью локальной ветки - коммиты этой цели плюс рабочее дерево.${touchedOrig(v) ? `\nТест диагноста ${repro.repro_test} изменён кодером: исходник - git show ${repro.repro_blob}. Изменена проверка - вход, вызываемый путь или ожидаемое - находка P1.` : ''}${f ? `\nВход от кодера - red-run: ${f['red-run']}\nuncovered: ${f['uncovered-status']}${(f.uncovered || []).length ? ' - ' + f.uncovered.join('; ') : ''}\ndependents: ${f['dependents-status']}${(f.dependents || []).length ? ' - ' + f.dependents.join('; ') : ''}` : ''} Источник намерения:\n${causeText}${priors.length ? `\nПрежние находки - статус каждой в prior с тем же id и уликой; оставшаяся в коде идёт в prior, не в findings:\n${priors.map(priorLine).join('\n')}` : ''}\nПрогон build/test реальный, итог - в run-status, не в findings. Код не меняй.`,
  { label: `self-review:${tag}`, phase: 'Review', schema: REVIEW }, 'dex-self-reviewer:self-reviewer')
let rev = await review('первое', fix, ver, LEDGER); loops.review = 1
let carried = []
trail.push({ step: 3, doer: 'self-reviewer', status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1, verdict: rev ? rev['review-verdict'] : null })
const isBlocking = (f) => f.severity === 'P0' || f.severity === 'P1'
const blockingOf = (r) => r ? r.findings.filter(isBlocking) : []
// Статус прежней находки - последний, названный ревью; о которой ревью промолчало, остаётся открытой с этой пометкой.
const UNSETTLED = 'статус саморевью не сверен'
const priors = new Map()
const keyOf = (p) => p.id || `@${p.anchor}`
const seat = (p, status, evidence) => priors.set(keyOf(p), { id: p.id || '', anchor: p.anchor || '', severity: p.severity || '', text: p.text || '', status, evidence })
LEDGER.forEach(l => seat(l, 'open', UNSETTLED))
function apply(r) {
  if (!r || r.status === 'blocked') return
  for (const p of r.prior || []) {
    const hit = [...priors.values()].find(q => p.id && q.id ? p.id === q.id : p.anchor === q.anchor)
    seat(hit || p, p.status, p.evidence)
  }
}
const openPrior = () => [...priors.values()].filter(p => p.status === 'open' || p.status === 'partial')
const blockingPrior = () => openPrior().filter(isBlocking)
apply(rev)
if (rev && rev.status !== 'blocked' && (blockingOf(rev).length || blockingPrior().length)) {
  loops.review_fix = REVIEW_FIX_CEILING
  fix2 = await node('кодер', `${HEAD}Шаг 2 (повтор после саморевью, потолок ${REVIEW_FIX_CEILING}): закрой находки:\n${[...blockingPrior(), ...blockingOf(rev)].map(priorLine).join('\n')}\n${causeText}\n${acceptance()}\nПосле правки сборка и тесты зелёные, коммит локально, push не делать. По каждой находке - запись в prior с тем же id и anchor: closed с уликой либо disputed с основанием, почему закрывать не следует.`,
    { label: 'fix:after-review', phase: 'Review', schema: FIX }, coderType)
  const dc2 = noteCheck(fix2)
  if (fix2) decisions.push(...said(fix2))
  if (/^disputed-/.test(dc2)) {
    trail.push({ step: '2-after-review', doer: coderType || 'general-purpose', status: fix2.status, 'diagnosis-check': dc2 })
    disputes.push(`${dc2} (правка по находкам): ${fix2.dispute || 'улика не названа'}`)
    return disputeExit(dc2, fix2, 'Review: правка по находкам', { fix_after_review: fix2, review: rev, open_findings: rev.findings, prior: [...priors.values()] })
  }
  ver2 = !fix2 || fix2.status === 'blocked' ? null : await verifyOnce('после саморевью', 'Review')
  settle(ver2)
  trail.push({ step: '2-after-review', doer: coderType || 'general-purpose', status: fix2 ? fix2.status : 'null', passed: isGreen(ver2), 'red-run': fix2 ? fix2['red-run'] : null })
  const openNow = { review: rev, open_findings: rev.findings, prior: [...priors.values()] }
  if (!fix2 || fix2.status === 'blocked') return bail('Review: правка по находкам', fix2 ? fix2.missing : 'узел-кодер не вернул выход', openNow)
  if (noRun(ver2)) return bail('Review: верификация после правки', lack(ver2), openNow)
  const rev1 = rev
  // Повторное ревью покупается не всегда. Правка, целиком проверенная прогоном и не видимая наружу,
  // получает от второго ревью подтверждение верификации, а не новый факт: по ledger круг окупался
  // в 5 случаях из 23. Невыясненное круг не отменяет: у обоих полей это отдельное значение
  // перечня (unknown), и пропуск даёт только пара none + none.
  // Перечень судится наравне со статусом: пара «none + непустой перечень» противоречива, и пропуск по
  // статусу отдал бы решение полю, которое сам же перечень опровергает.
  const sealed = (f) => f['uncovered-status'] === 'none' && f.uncovered.length === 0
    && f['dependents-status'] === 'none' && f.dependents.length === 0
  // Правку теста после harness-fixed гейт отдаёт ревью: сменивший хэш круг повторное ревью не пропускает.
  // Отказ кодера и его молчание - не закрытие: пропуск круга только когда каждую блокирующую он назвал закрытой.
  const same = (a, b) => a.id && b.id ? a.id === b.id : a.anchor === b.anchor
  const closedByCoder = (f) => (fix2.prior || []).some(p => same(p, f) && p.status === 'closed')
  if (isGreen(ver2) && sealed(fix2) && ver2.repro_test_hash === ver.repro_test_hash && [...blockingPrior(), ...blockingOf(rev1)].every(closedByCoder)) {
    loops.review = 1
    // Находка без своей строки решения - шаг не выполнен: снятая правкой идёт в decisions поимённо.
    const why = 'закрыта правкой, повторное саморевью не куплено - правка покрыта прогоном (uncovered-status: none), наружу не видна (dependents-status: none), верификация зелёная'
    const shut = [...blockingPrior(), ...blockingOf(rev1)]
    shut.forEach(f => {
      decisions.push(`${f.anchor}: ${why}${f.closure ? `; критерий закрытия: ${f.closure}` : ''}`)
      seat(f, 'closed', why)
    })
    rev = { ...rev1, findings: rev1.findings.filter(f => !(f.severity === 'P0' || f.severity === 'P1')) }
    trail.push({ step: '3-repeat', doer: 'не куплено: правка замкнута и проверена прогоном', status: 'skipped', closed: shut.length })
  } else {
    const recheck = blockingOf(rev1).map(f => ({ id: '', anchor: f.anchor, severity: f.severity, text: f.text }))
    rev = await review('повторное', fix2, ver2, [...openPrior(), ...recheck]); loops.review = 2
    // Повторное ревью без выхода или blocked не закрывает находки первого: они остаются открытыми.
    if (!rev || rev.status === 'blocked') carried = blockingOf(rev1)
    else {
      // Находка первого ревью, названная повторным снова в findings, уже открыта там - второй записью в prior она задвоилась бы.
      recheck.filter(f => !rev.findings.some(n => n.anchor === f.anchor)).forEach(f => seat(f, 'open', UNSETTLED))
      apply(rev)
    }
    trail.push({ step: '3-repeat', doer: 'self-reviewer', status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1, verdict: rev ? rev['review-verdict'] : null })
  }
}
const finalVer = ver2 || ver
// partial кодера и опровергнутая им сверка - исход автора: зелёная верификация и чистое ревью их не закрывают.
const authorGap = (f) => !f ? '' : f.status === 'partial' ? `кодер вернул partial: ${f.missing || f['run-status'] || 'нехватка не названа'}` : /^contradicted/.test(f['fact-check']) ? `fact-check кодера: ${f['fact-check']}` : ''
// Удалённый тест - разрыв при любой приёмке и без снимка: путь верификатору назван треком. Правка теста - против ожидания,
// а не вердикта: суждение «обвязка или проверка» ревью несёт на круге приёмки, дальше тест держится снимком.
// Тест в диагнозе, а правка прошла без записанной приёмки (n/a при тесте) - тоже разрыв.
const testGap = testMissing(finalVer) ? `тест диагноста ${repro.repro_test} удалён (repro_test_hash: ${hashOf(finalVer) || 'пусто'})`
  : !!expected() && finalVer.repro_test_hash !== expected() ? `тест диагноста ${repro.repro_test} изменён при diagnosis-check: ${((fix2 || fix) || {})['diagnosis-check'] || repro.accepted || 'не назван'}`
  : fix && repro.repro_test && !repro.accepted ? `приёмка диагноза не проведена: diagnosis-check ${(fix2 || fix)['diagnosis-check'] || 'не назван'} при тесте диагноста ${repro.repro_test}` : ''
const reviewGap = !rev || rev.status === 'blocked' ? '' : rev.status === 'partial' ? `саморевью не завершено: ${rev.missing || 'нехватка не названа'}` : rev['intent-status'] === 'mismatch' ? `саморевью: реализовано не то: ${rev.intent}` : ''
const gap = [ledgerUnread ? 'реестр прежних находок не прочитан - открытые P0/P1 прошлого прогона не сверены' : '', authorGap(fix2 || fix) || testGap || (repro.status === 'partial' ? `воспроизведение partial: ${repro.missing || `эталон - ${repro['expected-basis']}`}` : ''),
  !repro.build_cmd && !repro.test_cmd ? 'внешнего факта нет: ни сборки, ни тестов' : '', !finalVer.ahead ? 'коммитов трека нет' : '', reviewGap].filter(Boolean).join('; ')
const green = isGreen(finalVer)
// Порог допуска: зелёная верификация и ноль открытых P0/P1. Рекомендация push - сигнал оператору в выходе, не гейт:
// как гейт она держала прогон на неблокирующих находках (P2/P3 - 85% находок ledger) и требовала лишнего прогона.
const open_findings = carried.length ? [...carried, ...(rev ? rev.findings : [])] : rev ? rev.findings : []
const stuck = blockingPrior()
const where = !green ? 'верификация после правки по саморевью не прошла'
  : !rev ? 'саморевьюер не вернул выход'
  : rev.status === 'blocked' ? `саморевью не выполнено: ${rev.missing || 'узел вернул blocked без нехватки'}`
  : blockingOf(rev).length ? 'открытые P0/P1 после повторного саморевью'
  : stuck.length ? `прежние P0/P1 не закрыты: ${stuck.map(p => `${p.id || p.anchor} ${p.status} - ${p.evidence}`).join('; ')}` : gap
return {
  status: where ? 'partial' : 'complete',
  where, missing: where,
  goal_check: { build_ok: finalVer.build_ok, tests_green: finalVer.exit_code === 0 && finalVer.fail_count === 0, committed: !finalVer.dirty && finalVer.ahead > 0, head: finalVer.head },
  loops, trail, degraded, repro, fix, fix_after_review: fix2, review: rev, open_findings, prior: [...priors.values()], disputes,
  decisions: dec(),
}
