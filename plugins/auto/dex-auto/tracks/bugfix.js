// Трек bugfix как Workflow-скрипт (artifacts.md, O12 вариант A). Ядро - debugger на воспроизведении и первопричине,
// фикс - кодер по стеку (коммит в его контракте, у debugger - нет). Узел-обёртка, верификация и саморевью - как в feature.js.
// Вход через args: { task, symptom, expected, env, done, boundary, mode, cwd, source, goal_path, resume, trail , open_findings }.
export const meta = {
  name: 'dex-auto-bugfix',
  description: 'Трек bugfix: воспроизведение и первопричина (debugger) -> фикс кодером с верификацией (потолок 3) -> саморевью -> правка по находкам (потолок 1)',
  phases: [
    { title: 'Reproduce', detail: 'debugger: red-run или прослеженный путь, первопричина, предложение фикса; код не меняет' },
    { title: 'Fix', detail: 'кодер по стеку лечит первопричину x верификация внешним фактом, потолок 3; при возобновлении - сначала верификация' },
    { title: 'Review', detail: 'саморевью, при блокирующих находках одна правка и повторное ревью' },
  ],
}

const A = args || {}
const FIX_CEILING = 3, REVIEW_FIX_CEILING = 1
const HEAD = `mode: ${A.mode || 'autonomous'}\nцель (${A.task}): починить баг - симптом: ${A.symptom}\nожидаемое: ${A.expected || 'не задано - реконструируй из тестов и корпуса, назови основание'}\nокружение: ${A.env || 'не задано'}\nкритерий «готово»: ${A.done}\nграница: ${A.boundary || 'не выходить за рабочий каталог'}\nфайл цели: ${A.goal_path || 'нет'}\nРаботай только внутри ${A.cwd}. Push, деплой, миграции данных и удаление вне рабочего дерева не делать - это стоп-линия. Оператора нет: невыводимое не додумывай, верни status: blocked с полем нехватки.\n`
const DONE = A.resume && A.trail ? `\nВозобновление: шаги ниже уже сделаны (из ledger), не повторяй их, продолжай с незакрытого:\n${A.trail}\n` : ''
const OPEN = A.resume && A.open_findings ? `\nНезакрытые находки прошлого прогона (из ledger): закрой каждую либо верни в decisions с основанием, почему закрывать не следует:\n${A.open_findings}\n` : ''

const STATUS = { type: 'string', enum: ['complete', 'blocked', 'partial'] }
const REPRO = { type: 'object', properties: {
  status: STATUS,
  stack: { type: 'string', description: 'идентификатор стека по реестру (Skill dex-skill-stack-registry:stack-registry); вне реестра - "other"' },
  root_cause: { type: 'string', description: 'первопричина с привязкой файл:строка, не симптом' },
  reproduction: { type: 'string', description: '"тест <имя>: красный, <вывод>" либо прослеженный путь от входа до места сбоя' },
  expected_basis: { type: 'string', description: 'откуда взято ожидаемое: вход, тест, корпус, реконструкция' },
  fix_proposal: { type: 'string', description: 'минимальная правка словами: файл, что меняется' },
  files: { type: 'array', items: { type: 'string' } },
  test_cmd: { type: 'string', description: 'команда прогона тестов; нет тестов - пустая строка' },
  build_cmd: { type: 'string', description: 'команда сборки/типизации; нет - пустая строка' },
  missing: { type: 'string', description: 'при blocked - чего не хватает и у кого это есть' },
}, required: ['status', 'stack', 'root_cause', 'reproduction', 'expected_basis', 'fix_proposal', 'files', 'test_cmd', 'build_cmd', 'missing'] }
const FIX = { type: 'object', properties: {
  status: STATUS,
  changed_files: { type: 'array', items: { type: 'string' } },
  commit: { type: 'string', description: 'sha локального коммита либо пусто' },
  red_run: { type: 'string', description: 'какой тест был красным до правки и зелёным после' },
  decisions: { type: 'array', items: { type: 'string' }, description: 'каждая закрытая узлом развилка: что выбрано, из чего, почему' },
  missing: { type: 'string' },
}, required: ['status', 'changed_files', 'commit', 'red_run', 'decisions', 'missing'] }
const VERIFY = { type: 'object', properties: {
  status: STATUS,
  exit_code: { type: 'integer' }, pass_count: { type: 'integer' }, fail_count: { type: 'integer' },
  failing: { type: 'array', items: { type: 'string' } },
  build_ok: { type: 'boolean' },
  head: { type: 'string', description: 'git log --oneline -3' },
  dirty: { type: 'boolean', description: 'git status --porcelain непустой' },
  missing: { type: 'string', description: 'при blocked - почему прогон не выполнен; иначе пусто' },
}, required: ['status', 'exit_code', 'pass_count', 'fail_count', 'failing', 'build_ok', 'head', 'dirty', 'missing'] }
const REVIEW = { type: 'object', properties: {
  status: STATUS,
  findings: { type: 'array', items: { type: 'object', properties: {
    severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] }, anchor: { type: 'string' }, text: { type: 'string' },
  }, required: ['severity', 'anchor', 'text'] } },
  run_status: { type: 'string', description: 'итог реального прогона build/test ревьюером' },
  push_recommended: { type: 'boolean' },
  push_blockers: { type: 'string', description: 'почему push не рекомендован; пусто, если рекомендован' },
  missing: { type: 'string', description: 'при blocked - чего не хватило для ревью; иначе пусто' },
}, required: ['status', 'findings', 'run_status', 'push_recommended', 'push_blockers', 'missing'] }

const CODER = { ts: 'dex-ts-fullstack-coder:ts-fullstack-assistant', dotnet: 'dex-dotnet-coder:dotnet-coder' }
const loops = { fix: 0, review_fix: 0, review: 0 }
const trail = [], degraded = []
let fix = null, fix2 = null, ver = null, ver2 = null
// Решения копятся по попыткам: fix перезаписывается каждым кругом, и без накопления в ledger уезжает только последний.
const decisions = []
const dec = () => decisions.slice()
const bail = (where, missing, extra) => ({ status: 'blocked', where, missing, loops, trail, degraded, decisions: dec(), repro, fix, ...extra })
// Верификатор, не сумевший прогнать, по exit_code неотличим от красных тестов: без этой ветки трек проедает потолок правок вхолостую.
const noRun = (v) => !v || v.status === 'blocked'
const lack = (v) => (v && v.missing) || 'верификатор не вернул выход'
// Узел каталога может быть не установлен: тогда general-purpose с ролью в промпте, факт - в degraded (graceful degradation).
async function node(role, prompt, opts, type) {
  if (type) {
    try { const r = await agent(prompt, { ...opts, agentType: type }); return r }
    catch (e) { degraded.push(`${role}: ${type} недоступен (${String(e && e.message || e).slice(0, 120)})`); log(`узел ${type} недоступен, general-purpose`) }
  }
  return agent(`Роль: ${role}.\n${prompt}`, { ...opts, agentType: 'general-purpose' })
}
const isGreen = (v) => !!v && v.exit_code === 0 && v.build_ok && !v.dirty

phase('Reproduce')
const repro = await node('диагност первопричины', `${HEAD}${DONE}Шаг 1: воспроизведение и первопричина. Источник: ${A.source || 'формулировка выше'}. ${A.goal_path ? 'Прочитай файл цели: раздел «Контекст» (файлы, команды тестов и сборки, корпус) сверь с манифестом, не ищи заново.' : 'Команды тестов и сборки - по манифесту репозитория.'} Стек - идентификатор по реестру: вызови Skill dex-skill-stack-registry:stack-registry и определи по манифесту. Воспроизведи: красный тест (можно написать новый тест, но не менять исходный код) либо прослеженный путь от входа до места сбоя. Назови первопричину с файл:строка и минимальную правку словами. Исходный код не меняй; написанный тест оставь незакоммиченным в дереве.`,
  { label: 'reproduce', phase: 'Reproduce', schema: REPRO }, 'dex-debugger:debugger')
trail.push({ step: 1, doer: 'debugger', status: repro ? repro.status : 'null' })
if (!repro || repro.status === 'blocked') return bail('Reproduce', repro ? repro.missing : 'узел воспроизведения не вернул выход')
const causeText = `Первопричина: ${repro.root_cause}\nВоспроизведение: ${repro.reproduction}\nОснование ожидаемого: ${repro.expected_basis}\nПредложение фикса: ${repro.fix_proposal}`
const coderType = CODER[repro.stack]

phase('Fix')
const verifyOnce = (tag) => node('верификатор', `${HEAD}Верификация (${tag}): ТОЛЬКО прогон и отчёт, код не менять. Выполни ${repro.build_cmd ? `сборку: ${repro.build_cmd}; ` : ''}${repro.test_cmd ? `тесты: ${repro.test_cmd}` : 'тестов нет - build_ok по сборке, счётчики 0'}; затем git log --oneline -3 и git status --porcelain. Числа - из вывода раннера как есть.`,
  { label: `verify:${tag}`, phase: 'Fix', effort: 'low', schema: VERIFY })
// Возобновление начинается с верификации: зелёное дерево с коммитами не переделывается (ledger.md, «продолжить»).
if (A.resume) {
  ver = await verifyOnce('возобновление')
  trail.push({ step: 'resume', doer: 'general-purpose', passed: isGreen(ver) })
  if (noRun(ver)) return bail('Fix: верификация при возобновлении', lack(ver))
}
// Зелёное дерево с незакрытыми находками прошлого прогона не выпускает трек мимо правки (ledger.md, «продолжить»).
let pending = !!(A.resume && A.open_findings)
for (let k = 1; k <= FIX_CEILING && (!isGreen(ver) || pending); k++) {
  loops.fix = k; pending = false
  const prev = ver ? `\n${k === 1 ? 'Верификация при возобновлении' : `Попытка ${k - 1}`} не прошла: exit=${ver.exit_code}, build_ok=${ver.build_ok}, падают: ${ver.failing.join('; ') || 'нет'}, dirty=${ver.dirty}.` : ''
  fix = await node('кодер', `${HEAD}${DONE}${OPEN}Шаг 2, попытка ${k} из ${FIX_CEILING}: лечи первопричину, не симптом; один баг - один фикс, попутного рефакторинга нет.\n${causeText}\nФайлы: ${repro.files.join(', ')}. Тесты: ${repro.test_cmd || 'нет'}. Сборка: ${repro.build_cmd || 'нет'}.${prev}\nRed-run: названный тест красный до правки, зелёный после (тест из воспроизведения, если он в дереве, - включи в коммит). По завершении: сборка и тесты зелёные, коммит локально (сообщение по симптому), push не делать.`,
    { label: `fix:${k}`, phase: 'Fix', schema: FIX }, coderType)
  trail.push({ step: 2, attempt: k, doer: coderType || 'general-purpose', status: fix ? fix.status : 'null' })
  if (fix) decisions.push(...(fix.decisions || []))
  if (!fix || fix.status === 'blocked') return bail(`Fix#${k}`, fix ? fix.missing : 'узел-кодер не вернул выход')
  ver = await verifyOnce(`после попытки ${k}`)
  trail.push({ step: '2-exit', attempt: k, doer: 'general-purpose', passed: isGreen(ver) })
  if (noRun(ver)) return bail(`Fix#${k}: верификация`, lack(ver))
  if (!isGreen(ver)) log(`попытка ${k}: exit=${ver && ver.exit_code}, build_ok=${ver && ver.build_ok}, fail=${ver && ver.fail_count}, dirty=${ver && ver.dirty}`)
}
if (!isGreen(ver)) return { status: 'partial', where: `Fix: потолок ${FIX_CEILING} исчерпан`, ver, repro, fix, loops, trail, degraded, decisions: dec() }

phase('Review')
const review = (tag) => node('саморевьюер', `${HEAD}Шаг 3 (${tag}): pre-push саморевью локальной ветки - коммиты этой цели плюс рабочее дерево. Источник намерения:\n${causeText}\nПрогон build/test реальный, итог - в run_status, не в findings. Код не меняй.`,
  { label: `self-review:${tag}`, phase: 'Review', schema: REVIEW }, 'dex-self-reviewer:self-reviewer')
let rev = await review('первое'); loops.review = 1
trail.push({ step: 3, doer: 'self-reviewer', status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1, push: rev ? rev.push_recommended : null })
const blockingOf = (r) => r ? r.findings.filter(f => f.severity === 'P0' || f.severity === 'P1') : []
if (rev && blockingOf(rev).length) {
  loops.review_fix = REVIEW_FIX_CEILING
  fix2 = await node('кодер', `${HEAD}Шаг 2 (повтор после саморевью, потолок ${REVIEW_FIX_CEILING}): закрой находки:\n${blockingOf(rev).map(f => `- [${f.severity}] ${f.anchor}: ${f.text}`).join('\n')}\n${rev.push_blockers ? `Причина отказа в push: ${rev.push_blockers}\n` : ''}${causeText}\nПосле правки сборка и тесты зелёные, коммит локально, push не делать. Находку, которую закрывать не следует, верни в decisions с основанием.`,
    { label: 'fix:after-review', phase: 'Review', schema: FIX }, coderType)
  ver2 = !fix2 || fix2.status === 'blocked' ? null : await verifyOnce('после саморевью')
  trail.push({ step: '2-after-review', doer: coderType || 'general-purpose', status: fix2 ? fix2.status : 'null', passed: isGreen(ver2) })
  if (fix2) decisions.push(...(fix2.decisions || []))
  const openNow = { review: rev, open_findings: rev.findings }
  if (!fix2 || fix2.status === 'blocked') return bail('Review: правка по находкам', fix2 ? fix2.missing : 'узел-кодер не вернул выход', openNow)
  if (noRun(ver2)) return bail('Review: верификация после правки', lack(ver2), openNow)
  rev = await review('повторное'); loops.review = 2
  trail.push({ step: '3-repeat', doer: 'self-reviewer', status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1, push: rev ? rev.push_recommended : null })
}
const finalVer = ver2 || ver
const green = isGreen(finalVer)
const open_findings = rev ? rev.findings : []
return {
  status: green && rev && rev.status !== 'blocked' && !blockingOf(rev).length ? 'complete' : 'partial',
  where: !green ? 'верификация после правки по саморевью не прошла'
    : !rev ? 'саморевьюер не вернул выход'
    : rev.status === 'blocked' ? `саморевью не выполнено: ${rev.missing || 'узел вернул blocked без нехватки'}`
    : blockingOf(rev).length ? 'открытые P0/P1 после повторного саморевью' : '',
  goal_check: { build_ok: !!finalVer && finalVer.build_ok, tests_green: !!finalVer && finalVer.exit_code === 0, committed: !!finalVer && !finalVer.dirty, head: finalVer ? finalVer.head : '' },
  loops, trail, degraded, repro, fix, fix_after_review: fix2, review: rev, open_findings,
  decisions: dec(),
}
