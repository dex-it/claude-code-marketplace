// Трек разработки как Workflow-скрипт (artifacts.md, O12 вариант A; форма проверена probes.md P9).
// Вход через args: { task, goal, done, boundary, mode, kind: 'bugfix'|'feature', cwd }.
// Обязательства формы: status первым полем каждой схемы; потолки петель в скрипте; схема несёт
// поле под каждую часть контракта узла; нумерацию единиц отдаёт узел контекста.
export const meta = {
  name: 'dex-auto-development',
  description: 'Трек разработки: контекст R/I -> правка с верификацией (потолок 3) -> саморевью -> правка по находкам (потолок 1)',
  phases: [
    { title: 'Context', detail: 'R/I из тикета, кода и корпуса документации проекта' },
    { title: 'Implement', detail: 'узел-кодер по стеку x верификация внешним фактом, потолок 3' },
    { title: 'Review', detail: 'саморевью, при блокирующих находках одна правка и повторное ревью' },
  ],
}

const A = args || {}
const KIND = A.kind === 'feature' ? 'feature' : 'bugfix'
const FIX_CEILING = 3, REVIEW_FIX_CEILING = 1
const HEAD = `mode: ${A.mode || 'autonomous'}\nцель (${A.task}): ${A.goal}\nкритерий «готово»: ${A.done}\nграница: ${A.boundary || 'не выходить за рабочий каталог'}\nРаботай только внутри ${A.cwd}. Push, деплой, миграции данных и удаление вне рабочего дерева не делать - это стоп-линия. Оператора нет: невыводимое не додумывай, верни status: blocked с полем нехватки.\n`

const STATUS = { type: 'string', enum: ['complete', 'blocked', 'partial'] }
const CTX = { type: 'object', properties: {
  status: STATUS,
  stack: { type: 'string', enum: ['ts', 'dotnet', 'python', 'other'], description: 'по манифесту репозитория' },
  requirements: { type: 'array', items: { type: 'string' }, description: 'единицы R/I с номером R1..Rn и источником файл:строка либо пометкой "допущение"' },
  files: { type: 'array', items: { type: 'string' } },
  test_cmd: { type: 'string', description: 'команда прогона тестов; нет тестов - пустая строка' },
  build_cmd: { type: 'string', description: 'команда сборки/типизации; нет - пустая строка' },
  corpus: { type: 'string', description: 'найденный корпус документации проекта либо "корпуса нет"' },
  missing: { type: 'string', description: 'при blocked - чего не хватает и у кого это есть' },
}, required: ['status', 'stack', 'requirements', 'files', 'test_cmd', 'build_cmd', 'corpus', 'missing'] }
const FIX = { type: 'object', properties: {
  status: STATUS,
  changed_files: { type: 'array', items: { type: 'string' } },
  commit: { type: 'string', description: 'sha локального коммита либо пусто' },
  red_run: { type: 'string', description: 'какой тест был красным до правки и зелёным после; для feature - какие тесты добавлены' },
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
}, required: ['status', 'exit_code', 'pass_count', 'fail_count', 'failing', 'build_ok', 'head', 'dirty'] }
const REVIEW = { type: 'object', properties: {
  status: STATUS,
  findings: { type: 'array', items: { type: 'object', properties: {
    severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] }, anchor: { type: 'string' }, text: { type: 'string' },
  }, required: ['severity', 'anchor', 'text'] } },
  run_status: { type: 'string', description: 'итог реального прогона build/test ревьюером' },
  push_recommended: { type: 'boolean' },
  push_blockers: { type: 'string', description: 'почему push не рекомендован; пусто, если рекомендован' },
}, required: ['status', 'findings', 'run_status', 'push_recommended', 'push_blockers'] }

const CODER = { ts: 'dex-ts-fullstack-coder:ts-fullstack-assistant', dotnet: 'dex-dotnet-coder:dotnet-coder' }
const loops = { fix: 0, review_fix: 0, review: 0 }
const trail = [], degraded = []
// Узел каталога может быть не установлен: тогда general-purpose с ролью в промпте, факт - в degraded (graceful degradation).
async function node(role, prompt, opts, type) {
  if (type) {
    try { const r = await agent(prompt, { ...opts, agentType: type }); return r }
    catch (e) { degraded.push(`${role}: ${type} недоступен (${String(e && e.message || e).slice(0, 120)})`); log(`узел ${type} недоступен, general-purpose`) }
  }
  return agent(`Роль: ${role}.\n${prompt}`, { ...opts, agentType: 'general-purpose' })
}

phase('Context')
const ctx = await node('аналитик контекста', `${HEAD}Шаг 1 (${KIND}): требования R/I. Источник: ${A.source || 'формулировка цели выше'}; прочитай его, исходники и тесты. Поищи корпус документации проекта (docs/, README, ADR, CLAUDE.md) - нет, так и скажи. Определи стек по манифесту. Верни R/I: каждая единица пронумерована R1..Rn, с источником файл:строка либо пометкой "допущение". Код не меняй.`,
  { label: 'ctx:R-I', phase: 'Context', schema: CTX }, 'Explore')
trail.push({ step: 1, doer: 'Explore', status: ctx ? ctx.status : 'null' })
if (!ctx || ctx.status === 'blocked') return { status: 'blocked', where: 'Context', missing: ctx ? ctx.missing : 'узел контекста не вернул выход', loops, trail, degraded }
const reqText = ctx.requirements.join('\n')
const coderType = CODER[ctx.stack]

phase('Implement')
const verifyOnce = (tag) => node('верификатор', `${HEAD}Верификация (${tag}): ТОЛЬКО прогон и отчёт, код не менять. Выполни ${ctx.build_cmd ? `сборку: ${ctx.build_cmd}; ` : ''}${ctx.test_cmd ? `тесты: ${ctx.test_cmd}` : 'тестов нет - build_ok по сборке, счётчики 0'}; затем git log --oneline -3 и git status --porcelain. Числа - из вывода раннера как есть.`,
  { label: `verify:${tag}`, phase: 'Implement', effort: 'low', schema: VERIFY })
let fix = null, ver = null
for (let k = 1; k <= FIX_CEILING; k++) {
  loops.fix = k
  const prev = ver ? `\nПопытка ${k - 1} не прошла верификацию: exit=${ver.exit_code}, build_ok=${ver.build_ok}, падают: ${ver.failing.join('; ') || 'нет'}, dirty=${ver.dirty}.` : ''
  fix = await node('кодер', `${HEAD}Шаг 2 (${KIND}), попытка ${k} из ${FIX_CEILING}: реализация по требованиям, TDD${KIND === 'bugfix' ? ' (red-run: целевой тест красный до правки)' : ' (тесты на каждую R)'}.\nТребования:\n${reqText}\nФайлы: ${ctx.files.join(', ')}. Тесты: ${ctx.test_cmd || 'нет'}. Сборка: ${ctx.build_cmd || 'нет'}.${prev}\nПо завершении: сборка и тесты зелёные, коммит локально (сообщение по цели, без служебной нумерации R), push не делать.`,
    { label: `fix:${k}`, phase: 'Implement', schema: FIX }, coderType)
  trail.push({ step: 2, attempt: k, doer: coderType || 'general-purpose', status: fix ? fix.status : 'null' })
  if (!fix || fix.status === 'blocked') return { status: 'blocked', where: `Implement#${k}`, missing: fix ? fix.missing : 'узел-кодер не вернул выход', ctx, loops, trail, degraded }
  ver = await verifyOnce(`после попытки ${k}`)
  const ok = !!ver && ver.exit_code === 0 && ver.build_ok && !ver.dirty
  trail.push({ step: '2-exit', attempt: k, doer: 'general-purpose', passed: ok })
  if (ok) break
  log(`попытка ${k}: exit=${ver && ver.exit_code}, build_ok=${ver && ver.build_ok}, fail=${ver && ver.fail_count}, dirty=${ver && ver.dirty}`)
}
if (!ver || ver.exit_code !== 0 || !ver.build_ok || ver.dirty) return { status: 'partial', where: `Implement: потолок ${FIX_CEILING} исчерпан`, ver, ctx, fix, loops, trail, degraded }

phase('Review')
const review = (tag) => node('саморевьюер', `${HEAD}Шаг 3 (${tag}): pre-push саморевью локальной ветки - коммиты этой цели плюс рабочее дерево. Источник намерения - требования:\n${reqText}\nПрогон build/test реальный, итог - в run_status, не в findings. Код не меняй.`,
  { label: `self-review:${tag}`, phase: 'Review', schema: REVIEW }, 'dex-self-reviewer:self-reviewer')
let rev = await review('первое'); loops.review = 1
trail.push({ step: 3, doer: 'self-reviewer', status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1, push: rev ? rev.push_recommended : null })
const blockingOf = (r) => r ? r.findings.filter(f => f.severity === 'P0' || f.severity === 'P1') : []
let fix2 = null, ver2 = null
if (rev && blockingOf(rev).length) {
  loops.review_fix = REVIEW_FIX_CEILING
  fix2 = await node('кодер', `${HEAD}Шаг 2 (повтор после саморевью, потолок ${REVIEW_FIX_CEILING}): закрой находки:\n${blockingOf(rev).map(f => `- [${f.severity}] ${f.anchor}: ${f.text}`).join('\n')}\n${rev.push_blockers ? `Причина отказа в push: ${rev.push_blockers}\n` : ''}Требования:\n${reqText}\nПосле правки сборка и тесты зелёные, коммит локально, push не делать. Находку, которую закрывать не следует, верни в decisions с основанием.`,
    { label: 'fix:after-review', phase: 'Review', schema: FIX }, coderType)
  ver2 = await verifyOnce('после саморевью')
  trail.push({ step: '2-after-review', doer: coderType || 'general-purpose', status: fix2 ? fix2.status : 'null', passed: !!ver2 && ver2.exit_code === 0 && ver2.build_ok && !ver2.dirty })
  rev = await review('повторное'); loops.review = 2
  trail.push({ step: '3-repeat', doer: 'self-reviewer', status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1, push: rev ? rev.push_recommended : null })
}
const finalVer = ver2 || ver
const green = !!finalVer && finalVer.exit_code === 0 && finalVer.build_ok && !finalVer.dirty
const open_findings = rev ? rev.findings : []
return {
  status: green && rev && !blockingOf(rev).length ? 'complete' : 'partial',
  where: green ? (rev ? (blockingOf(rev).length ? 'открытые P0/P1 после повторного саморевью' : '') : 'саморевьюер не вернул выход') : 'верификация после правки по саморевью не прошла',
  goal_check: { build_ok: !!finalVer && finalVer.build_ok, tests_green: !!finalVer && finalVer.exit_code === 0, committed: !!finalVer && !finalVer.dirty, head: finalVer ? finalVer.head : '' },
  loops, trail, degraded, ctx, fix, fix_after_review: fix2, review: rev, open_findings,
  decisions: [].concat(fix ? fix.decisions : [], fix2 ? fix2.decisions : []),
}
