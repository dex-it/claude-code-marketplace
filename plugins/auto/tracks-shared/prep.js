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
