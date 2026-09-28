// Техконтекст выводится из манифеста, а не из цели: его отдаёт дешёвый узел подготовки, следующие узлы получают команды готовыми.
const PREP = { type: 'object', properties: {
  status: STATUS,
  stack: { type: 'string', description: 'идентификатор стека по реестру (Skill dex-skill-stack-registry:stack-registry); вне реестра - "other"' },
  stack_basis: { type: 'string', description: 'манифест, из которого выведен стек (путь:строка); манифеста нет - чем определено иначе' },
  test_cmd: { type: 'string', description: 'команда прогона тестов; нет тестов - пустая строка' },
  build_cmd: { type: 'string', description: 'команда сборки/типизации; нет - пустая строка' },
  prepare_cmd: { type: 'string', description: 'команда подготовки дерева до сборки; подготовка не нужна - пустая строка' },
  // Enum: «дерево готово» и «готовить нечего» ведут к разному промпту дальше, а провал установки пустой строкой неотличим от успеха до первой сборки.
  'prepare-status': { type: 'string', enum: ['done', 'not-needed', 'failed'], description: 'done - команда вернула 0; not-needed - prepare_cmd пуст; failed - команда вернула не 0 либо не запущена' },
  prepare_log: { type: 'string', description: 'при done - код возврата, чем подтверждено и возвращённые пути; при failed - команда и последние строки вывода; при not-needed - почему готовить нечего' },
  // Без базы унаследованное падение судится внесённым правкой, и кодер лечит чужой дефект из потолка попыток.
  'baseline-status': { type: 'string', enum: ['green', 'red', 'n/a'], description: 'сборка и тесты до правок трека: green - прошли; red - что-то упало; n/a - не прогонялись: в дереве уже есть правки трека, подготовка failed либо нет ни сборки, ни тестов' },
  baseline_log: { type: 'string', description: 'при red - что упало: сборка с хвостом вывода, тесты поимённо; при green - сколько тестов прошло; при n/a - почему не прогонялись' },
  missing: { type: 'string', description: 'при blocked - чего не хватает и у кого это есть' },
}, required: ['status', 'stack', 'stack_basis', 'test_cmd', 'build_cmd', 'prepare_cmd', 'prepare-status', 'prepare_log', 'baseline-status', 'baseline_log', 'missing'] }
// Правки проверяются до установки: неигнорируемый артефакт установки иначе читался бы правкой трека.
const PREP_STEPS = `1. Правки трека: git status --porcelain и ${AHEAD_CMD}. Вывод непуст либо число больше нуля - в дереве уже есть правки трека.
2. Стек - идентификатор по реестру: вызови Skill dex-skill-stack-registry:stack-registry и сопоставь с манифестом дерева; вне реестра - "other". Манифест, из которого вывел, назови в stack_basis - догадка по именам файлов не принимается. По тому же манифесту назови команды сборки и тестов.
3. Подготовка: дереву до сборки нужны зависимости, которых сборка сама не ставит, либо шаг подготовки, названный проектом, - назови команду и выполни её в дереве; не нужны - prepare_cmd пуст, prepare-status: not-needed. Строки git status --porcelain, которых до команды не было, верни: ?? - удали путь, прочие - git checkout -- путь. prepare-status: done - команда вернула 0, иначе failed.
4. База: правки трека есть, prepare-status failed либо нет ни сборки, ни тестов - baseline-status: n/a с причиной. Иначе выполни сборку и тесты названными командами: всё прошло - green, что-то упало - red, упавшее в baseline_log.
Код не правь и упавшее не чини: база - замер до правок, чинят следующие узлы.`
// Первый замер green либо red из trail старше свежего: на возобновлении дерево несёт правки трека, а их опознание узлом не гарантия.
function baselineOf(p, trail) {
  const steps = Array.isArray(trail) ? trail : String(trail || '').split('\n')
  for (const s of steps) {
    const e = typeof s === 'string' ? fromLedger(s.replace(/^- /, '')) : s
    if (e && e.step === '1-tree' && ['green', 'red'].includes(e.baseline)) return { status: e.baseline, log: e.baseline_log || '', fresh: false }
  }
  if (p && ['green', 'red'].includes(p['baseline-status'])) return { status: p['baseline-status'], log: p.baseline_log || '', fresh: true }
  return null
}
const baselineNote = (b) => !b ? '' : b.status === 'red'
  ? ` До правок трека сборка и тесты уже падали (${b.log || 'что упало, не названо'}): эти падения унаследованы, прочие внесены правками трека.`
  : ' До правок трека сборка и тесты были зелёными: любое падение внесено правками трека.'
