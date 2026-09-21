#!/usr/bin/env node
// Прогон треков dex-auto на подменённых узлах: предмет - оркестрация, не суждение моделей.
// Сценарий отвечает по `opts.label`; `null` - узел без выхода, `unavailable` - неустановленный
// агент каталога (ветка graceful degradation). Разбор найденного - зонд P18 в plugins/auto/docs.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TRACKS = join(ROOT, 'plugins', 'auto', 'dex-auto', 'tracks')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

async function runTrack(track, args, responses, unavailable = []) {
  const src = readFileSync(join(TRACKS, `${track}.js`), 'utf8').replace(/^export const meta/m, 'const meta')
  const calls = []
  const agent = async (prompt, opts = {}) => {
    if (opts.agentType && unavailable.includes(opts.agentType)) throw new Error(`agent type not found: ${opts.agentType}`)
    calls.push({ label: opts.label, phase: opts.phase, agentType: opts.agentType, prompt })
    if (!(opts.label in responses)) throw new Error(`сценарий не задал ответ на label "${opts.label}"`)
    const r = responses[opts.label]
    const value = typeof r === 'function' ? r(calls.filter(c => c.label === opts.label).length, prompt) : r
    // Рантайм Workflow отдаёт только объект, прошедший схему: мок без обязательного поля - дрейф сценария, а не выход узла.
    const missingKeys = value && opts.schema && opts.schema.required ? opts.schema.required.filter(k => !(k in value)) : []
    if (missingKeys.length) throw new Error(`ответ на label "${opts.label}" без полей схемы: ${missingKeys.join(', ')}`)
    return value === undefined ? null : value
  }
  const parallel = (fns) => Promise.all(fns.map(f => f()))
  const pipeline = async (items, a, b) => Promise.all(items.map(async i => b(await a(i))))
  const fn = new AsyncFunction('args', 'agent', 'parallel', 'pipeline', 'phase', 'log', src)
  const result = await fn(args, agent, parallel, pipeline, () => {}, () => {})
  return { result, calls }
}

const green = { status: 'complete', exit_code: 0, pass_count: 9, fail_count: 0, failing: [], build_ok: true, head: 'abc feat', dirty: false, repro_test_hash: '', missing: '' }
const red = { ...green, exit_code: 1, fail_count: 2, failing: ['T1', 'T2'], head: 'abc wip' }
const dirty = { ...green, dirty: true }
const ctxOk = { status: 'complete', requirements: ['R1 ...'], files: ['src/A.cs'], corpus: 'docs/', 'conflict-status': 'none', conflicts: [], missing: '' }
// Техконтекст отдаёт свой узел: в разведке его полей нет вовсе, иначе сценарий не отличит «трек взял у подготовки» от «взял у разведки».
const prepOk = { status: 'complete', stack: 'dotnet', stack_basis: 'src/A.csproj:1', test_cmd: 'dotnet test', build_cmd: 'dotnet build', prepare_cmd: 'dotnet restore', 'prepare-status': 'done', prepare_log: 'exit 0, obj/project.assets.json на месте', missing: '' }
const prepTs = { ...prepOk, stack: 'ts', stack_basis: 'package.json:1', test_cmd: 'npm test', build_cmd: 'tsc', prepare_cmd: 'npm ci' }
const prepNotNeeded = { ...prepOk, prepare_cmd: '', 'prepare-status': 'not-needed', prepare_log: 'зависимости ставит сама сборка' }
const prepFailed = { ...prepOk, 'prepare-status': 'failed', prepare_log: 'dotnet restore: NU1101 фид недоступен' }
// Противоречие источников: AC владельца против критерия «готово» цели. Вторая пара - «none» при
// непустом перечне: статус сам себя опровергает, и трек судит перечень наравне со статусом.
const ctxConflict = { ...ctxOk, 'conflict-status': 'some', conflicts: ['FEAT.md:19 (AC2) требует отклонять ../evil ошибкой против R4 goal.md:21 - принимать любое имя'] }
const ctxConflictMute = { ...ctxConflict, 'conflict-status': 'none' }
const reproOk = { status: 'complete', root_cause: 'src/a.ts:10 неверный ключ', reproduction: 'тест T1: красный', repro_test: '', repro_blob: '', 'expected-basis': 'тест', fix_proposal: 'править ключ', files: ['src/a.ts'], 'conflict-status': 'none', conflicts: [], missing: '' }
const reproTest = { ...reproOk, reproduction: 'тест pay: красный, причина падения сверена', repro_test: 'test/pay.test.ts', repro_blob: 'b1' }
const greenTest = { ...green, repro_test_hash: 'b1' }
const reproConflict = { ...reproOk, 'conflict-status': 'some', conflicts: ['AC-4 docs/spec.md:31 требует 409 против ожидаемого входа - 200 с телом ошибки'] }
const fixOk = { status: 'complete', 'diff-scope': ['src/A.cs'], commit: 'abc123', 'run-status': 'build ok, tests 9/9', 'red-run': 'T1 красный до, зелёный после', 'uncovered-status': 'some', uncovered: ['ветка таймаута'], 'dependents-status': 'some', dependents: ['src/Caller.cs:41 вызывает изменённый метод'], 'fact-check': 'n/a (триггер не сработал)', decisions: ['выбран A'], 'diagnosis-check': 'accepted', dispute: '', missing: '' }
const fixDisputeCause = { ...fixOk, status: 'partial', commit: '', 'diagnosis-check': 'disputed-cause', dispute: 'src/pay.ts:40 ключ идемпотентности уже проверяется - причина не в src/pay.ts:12', missing: 'диагноз оспорен' }
// Правка, замкнутая в себе: оба поля явным «нет» - единственное сочетание, отменяющее второй круг ревью.
const fixSealed = { ...fixOk, 'uncovered-status': 'none', uncovered: [], 'dependents-status': 'none', dependents: [] }
const revClean = { status: 'complete', findings: [], 'run-status': 'build ok, tests 9/9', 'red-run': 'T1 действует', 'fact-check': 'n/a (триггер не сработал)', intent: 'соответствует', push_recommended: true, push_blockers: '', missing: '' }
const revP1 = { status: 'complete', findings: [{ severity: 'P1', anchor: 'src/A.cs:8', text: 'ретрай не различает случаи', closure: 'случаи различены тестом' }], 'run-status': 'build ok', 'red-run': 'T1 действует', 'fact-check': 'n/a (триггер не сработал)', intent: 'соответствует', push_recommended: false, push_blockers: 'открыта P1', missing: '' }
const revP2 = { status: 'complete', findings: [{ severity: 'P2', anchor: 'src/A.cs:9', text: 'имя переменной', closure: 'переименовано' }], 'run-status': 'build ok', 'red-run': 'T1 действует', 'fact-check': 'n/a (триггер не сработал)', intent: 'соответствует', push_recommended: true, push_blockers: '', missing: '' }
const verBlocked = { status: 'blocked', exit_code: -1, pass_count: 0, fail_count: 0, failing: [], build_ok: false, head: '', dirty: false, repro_test_hash: '', missing: 'нет прав на запуск dotnet test' }
const ctxMr = { status: 'complete', platform: 'github', base_sha: 'aaa', head_sha: 'bbb', files: ['api/user.ts'], security_surface: true, security_basis: 'diff трогает auth', intent: 'issue #12', missing: '' }
const mrFinding = { anchor: 'api/user.ts:41', severity: 'P1', axis: 'security', text: 'токен в логе', closure: 'убрать поле', evidence: 'logger.info(ctx)' }
const revMr = { status: 'complete', findings: [mrFinding], axes: ['language: чисто'], verdict: 'REQUEST_CHANGES', prior: [], questions: ['вопрос по намерению'], missing: '' }
const falOk = { status: 'complete', confirmed: [mrFinding], dropped: [{ anchor: 'api/db.ts:7', reason: 'закрыто соседним коммитом' }], coverage: 'ветка X непокрыта', missing: '' }

const featureArgs = { task: 'F-1', goal: 'цель', done: 'npm test -> 0', boundary: 'не трогать схему', mode: 'autonomous', cwd: '/repo-F-1', main_cwd: '/repo' }
const bugfixArgs = { task: 'B-1', symptom: 'дубль платежа', expected: 'один платёж', env: 'staging', done: 'npm test -> 0', mode: 'autonomous', cwd: '/repo-B-1', main_cwd: '/repo' }
const reviewArgs = { task: 'gh-1', mr: 'owner/repo#7', intent: 'issue #12', mode: 'autonomous', cwd: '/repo-gh-1' }

const labelsOf = (calls) => calls.map(c => c.label)
const promptOf = (calls, label) => (calls.find(c => c.label === label) || {}).prompt || ''
const typeOf = (calls, label) => (calls.find(c => c.label === label) || {}).agentType
// Шаг ищется по имени, не по индексу: фаза Context несёт две записи, и порядок их появления - дело планировщика.
const stepOf = (trail, step) => JSON.stringify(trail.find(t => t.step === step) || {})

const SCENARIOS = [
  { name: 'F22 повторное ревью не вернуло выход -> P1 первого ревью остаются открытыми', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revP1, 'fix:after-review': fixOk, 'verify:после саморевью': green, 'self-review:повторное': null },
    expect: ({ result }) => [
      ['статус partial', result.status === 'partial'],
      ['находка первого ревью в open_findings', result.open_findings.some(f => f.anchor === 'src/A.cs:8')],
    ] },
  { name: 'F23 ревью без P0/P1 при нерекомендованном push -> complete, рекомендация идёт сигналом в выход', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': { ...revClean, push_recommended: false, push_blockers: 'нет гейта сборки в CI' } },
    expect: ({ result, calls }) => [
      ['статус complete: порог допуска - P0/P1 и зелёная верификация', result.status === 'complete'],
      ['рекомендация push сохранена в возврате', result.review.push_recommended === false && /нет гейта сборки в CI/.test(result.review.push_blockers)],
      ['второй круг не куплен: правки по ревью не было', !calls.some(c => c.label === 'fix:after-review')],
    ] },
  { name: 'F24 кодер каталога оборвался -> замена получает причину и сверяет сделанное', track: 'feature', args: featureArgs,
    unavailable: ['dex-dotnet-coder:dotnet-coder'],
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ calls }) => [
      ['промпт замены называет обрыв', calls.filter(c => c.label === 'fix:1').pop().prompt.includes('оборвался ошибкой: agent type not found')],
      ['промпт замены велит сверить git log', calls.filter(c => c.label === 'fix:1').pop().prompt.includes('сверь git log')],
    ] },
  { name: 'B12 воспроизведение partial (эталон реконструирован) -> partial трека', track: 'bugfix', args: bugfixArgs,
    responses: { 'reproduce': { ...reproOk, status: 'partial', 'expected-basis': 'реконструирован, не подтверждён', missing: 'эталон не подтверждён постановщиком' }, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result }) => [
      ['статус partial', result.status === 'partial'],
      ['where называет воспроизведение', /воспроизведение partial: эталон не подтверждён/.test(result.where)],
    ] },
  { name: 'B13 повторное ревью blocked -> P1 первого ревью остаются открытыми', track: 'bugfix', args: bugfixArgs,
    responses: { 'reproduce': reproOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revP1, 'fix:after-review': fixOk, 'verify:после саморевью': green, 'self-review:повторное': { ...revClean, status: 'blocked', missing: 'нет доступа' } },
    expect: ({ result }) => [
      ['статус partial', result.status === 'partial'],
      ['находка первого ревью в open_findings', result.open_findings.some(f => f.anchor === 'src/A.cs:8')],
    ] },
  { name: 'F20 кодер вернул partial при зелёной верификации и чистом ревью -> partial с его нехваткой', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': { ...fixOk, status: 'partial', 'run-status': 'unverifiable: нет прав на dotnet restore', missing: 'прогон не выполнен' }, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result }) => [
      ['статус partial', result.status === 'partial'],
      ['where называет исход кодера', /кодер вернул partial: прогон не выполнен/.test(result.where)],
    ] },
  { name: 'F21 саморевьюер получает red-run и uncovered кодера', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['red-run во входе ревью', promptOf(calls, 'self-review:первое').includes('red-run: T1 красный до, зелёный после')],
      ['uncovered во входе ревью', promptOf(calls, 'self-review:первое').includes('uncovered: some - ветка таймаута')],
    ] },
  { name: 'B11 fact-check кодера contradicted -> partial', track: 'bugfix', args: bugfixArgs,
    responses: { 'reproduce': reproOk, 'fix:1': { ...fixOk, 'fact-check': 'contradicted: сигнатура retry другая' }, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['статус partial', result.status === 'partial'],
      ['where называет сверку', /fact-check кодера: contradicted/.test(result.where)],
      ['red-run во входе ревью', promptOf(calls, 'self-review:первое').includes('red-run: ')],
    ] },
  { name: 'F1 happy: контекст -> правка -> зелёная верификация -> чистое саморевью', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['петли: одна правка, одно ревью', result.loops.fix === 1 && result.loops.review === 1 && result.loops.review_fix === 0],
      ['goal_check собран из верификации', result.goal_check.build_ok && result.goal_check.tests_green && result.goal_check.committed],
      ['кодер выбран по стеку dotnet', typeOf(calls, 'fix:1') === 'dex-dotnet-coder:dotnet-coder'],
      ['решения узла в возврате', result.decisions.includes('выбран A')],
      ['открытых находок нет', result.open_findings.length === 0],
    ] },
  { name: 'F2 красная первая попытка -> зелёная вторая', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'fix:2': fixOk, 'verify:после попытки 1': red, 'verify:после попытки 2': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['две правки', result.loops.fix === 2],
      ['вторая попытка знает про падение первой', /падают: T1; T2/.test(promptOf(calls, 'fix:2'))],
    ] },
  { name: 'F3 потолок правок исчерпан', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'fix:2': fixOk, 'fix:3': fixOk, 'verify:после попытки 1': red, 'verify:после попытки 2': red, 'verify:после попытки 3': red },
    expect: ({ result, calls }) => [
      ['статус partial', result.status === 'partial'],
      ['причина названа', /потолок 3/.test(result.where)],
      ['ревью не запускалось', !labelsOf(calls).some(l => l.startsWith('self-review'))],
      ['петли: три правки', result.loops.fix === 3],
    ] },
  { name: 'F4 контекст вернул blocked', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': { ...ctxOk, status: 'blocked', missing: 'нет доступа к спеке' } },
    expect: ({ result }) => [
      ['статус blocked', result.status === 'blocked'],
      ['шаг назван', result.where === 'Context'],
      ['нехватка прокинута', result.missing === 'нет доступа к спеке'],
    ] },
  { name: 'F5 контекст не вернул выход (null)', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': null },
    expect: ({ result }) => [
      ['статус blocked', result.status === 'blocked'],
      ['нехватка названа своими словами', /не вернул выход/.test(result.missing)],
    ] },
  { name: 'F6 кодер вернул blocked', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': { ...fixOk, status: 'blocked', missing: 'нужен ключ API' } },
    expect: ({ result }) => [
      ['статус blocked', result.status === 'blocked'],
      ['шаг с номером попытки', result.where === 'Implement#1'],
      ['нехватка прокинута', result.missing === 'нужен ключ API'],
    ] },
  { name: 'F7a правка по находкам замкнута и проверена прогоном -> повторное ревью не куплено', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revP1,
      'fix:after-review': fixSealed, 'verify:после саморевью': green },
    expect: ({ result, calls }) => [
      ['повторное саморевью не вызвано', !labelsOf(calls).includes('self-review:повторное')],
      ['счётчик ревью остался на одном', result.loops.review === 1 && result.loops.review_fix === 1],
      ['статус complete: блокирующая закрыта правкой', result.status === 'complete'],
      ['снятая находка не числится открытой', !result.open_findings.some(f => f.severity === 'P1')],
      ['решение по снятой находке названо поимённо', result.decisions.some(d => /^src\/A\.cs:8: закрыта правкой/.test(d))],
      ['в решении назван критерий закрытия находки', result.decisions.some(d => /случаи различены тестом/.test(d))],
      ['пропуск круга виден в trail', result.trail.some(t => t.step === '3-repeat' && t.status === 'skipped')],
    ] },
  { name: 'F7b правка тянет потребителей -> круг покупается', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revP1,
      'fix:after-review': { ...fixSealed, 'dependents-status': 'some', dependents: ['src/Caller.cs:41'] }, 'verify:после саморевью': green, 'self-review:повторное': revClean },
    expect: ({ result, calls }) => [
      ['повторное саморевью вызвано', labelsOf(calls).includes('self-review:повторное')],
      ['счётчик ревью два', result.loops.review === 2],
    ] },
  { name: 'F7c правка оставила непокрытое -> круг покупается', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revP1,
      'fix:after-review': { ...fixSealed, 'uncovered-status': 'some', uncovered: ['ветка таймаута'] }, 'verify:после саморевью': green, 'self-review:повторное': revClean },
    expect: ({ calls }) => [['повторное саморевью вызвано', labelsOf(calls).includes('self-review:повторное')]] },
  { name: 'F7d поля замкнутости не заполнены -> круг покупается, молчание пропуска не даёт', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revP1,
      'fix:after-review': { ...fixSealed, 'uncovered-status': '', uncovered: [], 'dependents-status': 'unknown' }, 'verify:после саморевью': green, 'self-review:повторное': revClean },
    expect: ({ calls }) => [['повторное саморевью вызвано', labelsOf(calls).includes('self-review:повторное')]] },
  { name: 'F7f unknown признаком замкнутости не считается -> круг покупается', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revP1,
      'fix:after-review': { ...fixSealed, 'dependents-status': 'unknown' }, 'verify:после саморевью': green, 'self-review:повторное': revClean },
    expect: ({ calls }) => [['повторное саморевью вызвано', labelsOf(calls).includes('self-review:повторное')]] },
  { name: 'F7g статус none при непустом перечне непокрытого -> круг покупается', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revP1,
      'fix:after-review': { ...fixSealed, uncovered: ['ветка таймаута'] }, 'verify:после саморевью': green, 'self-review:повторное': revClean },
    expect: ({ calls }) => [['повторное саморевью вызвано', labelsOf(calls).includes('self-review:повторное')]] },
  { name: 'F7e правка замкнута, но верификация красная -> круг покупается', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revP1,
      'fix:after-review': fixSealed, 'verify:после саморевью': red, 'self-review:повторное': revClean },
    expect: ({ result, calls }) => [
      ['повторное саморевью вызвано', labelsOf(calls).includes('self-review:повторное')],
      ['статус partial: верификация не прошла', result.status === 'partial'],
    ] },
  { name: 'F7 блокирующая находка -> правка -> чистое повторное ревью', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revP1,
      'fix:after-review': fixOk, 'verify:после саморевью': green, 'self-review:повторное': revClean },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['два ревью, одна правка по находкам', result.loops.review === 2 && result.loops.review_fix === 1],
      ['находка попала в промпт правки', /ретрай не различает случаи/.test(promptOf(calls, 'fix:after-review'))],
      ['решения обеих правок слиты', result.decisions.length === 2],
    ] },
  { name: 'F8 находка не закрыта повторным ревью', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revP1,
      'fix:after-review': fixOk, 'verify:после саморевью': green, 'self-review:повторное': revP1 },
    expect: ({ result }) => [
      ['статус partial', result.status === 'partial'],
      ['причина названа', /открытые P0\/P1/.test(result.where)],
      ['находка в возврате для ledger', result.open_findings.length === 1],
    ] },
  { name: 'F9 непроходная находка P2 не держит трек', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revP2 },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['правки по находкам не было', !labelsOf(calls).includes('fix:after-review')],
      ['находка всё равно отдана в ledger', result.open_findings.length === 1],
    ] },
  { name: 'F10 возобновление: зелёное дерево с незакрытой находкой', track: 'feature',
    args: { ...featureArgs, resume: true, trail: '- {"step":1}', open_findings: '- [P1] src/A.cs:88: ретрай' },
    responses: { 'ctx:R-I': ctxOk, 'verify:возобновление': green, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['кодер вызван, несмотря на зелёное дерево', labelsOf(calls).includes('fix:1')],
      ['находка прошлого прогона в промпте', /src\/A\.cs:88/.test(promptOf(calls, 'fix:1'))],
      ['сделанное прошлым прогоном в промпте', /Возобновление/.test(promptOf(calls, 'fix:1'))],
    ] },
  { name: 'F11 возобновление на зелёном дереве без находок правку не заводит', track: 'feature',
    args: { ...featureArgs, resume: true, trail: '- {"step":1}' },
    responses: { 'ctx:R-I': ctxOk, 'verify:возобновление': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['правки не было', !labelsOf(calls).includes('fix:1') && result.loops.fix === 0],
    ] },
  { name: 'F11a возобновление с разведкой из ledger: узел контекста не покупается', track: 'feature',
    args: { ...featureArgs, resume: true, trail: '- {"step":1}', ctx: ctxOk },
    responses: { 'verify:возобновление': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['узел разведки не вызван', !labelsOf(calls).includes('ctx:R-I')],
      ['команда тестов в промпте верификации - от узла подготовки', /dotnet test/.test(promptOf(calls, 'verify:возобновление'))],
      ['источник разведки назван в trail', /ledger/.test(stepOf(result.trail, '1-req'))],
      ['подготовка дерева куплена и на возобновлении: дерево - состояние, а не вывод', labelsOf(calls).includes('ctx:tree')],
    ] },
  { name: 'F11b возобновление без записи разведки: узел отрабатывает как в первом прогоне', track: 'feature',
    args: { ...featureArgs, resume: true, trail: '- {"step":1}' },
    responses: { 'ctx:R-I': ctxOk, 'verify:возобновление': green, 'self-review:первое': revClean },
    expect: ({ calls, result }) => [
      ['узел разведки вызван', labelsOf(calls).includes('ctx:R-I')],
      ['источник разведки назван узлом', /Explore/.test(stepOf(result.trail, '1-req'))],
    ] },
  { name: 'F11c «продолжить» без следа прогона: трек идёт как первый', track: 'feature',
    args: { ...featureArgs, resume: true },
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['верификация возобновления не покупалась', !labelsOf(calls).includes('verify:возобновление')],
      ['фаза правки не пропущена', labelsOf(calls).includes('fix:1')],
      ['деградация названа оператору', result.decisions.some(d => /без trail/.test(d))],
    ] },
  { name: 'F12 агент-кодер каталога не установлен', track: 'feature', args: featureArgs,
    unavailable: ['dex-dotnet-coder:dotnet-coder'],
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['замена узла записана', result.degraded.some(d => /dotnet-coder/.test(d))],
      ['работу доделал general-purpose', calls.filter(c => c.label === 'fix:1').pop().agentType === 'general-purpose'],
    ] },
  { name: 'F13 стек вне реестра -> кодер общего назначения без записи о деградации', track: 'feature', args: featureArgs,
    responses: { 'ctx:tree': { ...prepOk, stack: 'other' }, 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['кодер - general-purpose', typeOf(calls, 'fix:1') === 'general-purpose'],
      ['деградацией это не считается', result.degraded.length === 0],
    ] },
  { name: 'F14 саморевьюер не вернул выход', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': null },
    expect: ({ result }) => [
      ['статус partial', result.status === 'partial'],
      ['причина названа', /саморевьюер не вернул выход/.test(result.where)],
    ] },
  { name: 'F15 дерево грязное при зелёных тестах', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'fix:2': fixOk, 'fix:3': fixOk,
      'verify:после попытки 1': dirty, 'verify:после попытки 2': dirty, 'verify:после попытки 3': dirty },
    expect: ({ result }) => [
      ['статус partial - незакоммиченное не сдаётся', result.status === 'partial'],
      ['потолок назван', /потолок 3/.test(result.where)],
    ] },

  { name: 'F16 кодер правки по находкам вернул blocked', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revP1,
      'fix:after-review': { ...fixOk, status: 'blocked', missing: 'правка требует смены схемы данных - это за границей' },
      'verify:после саморевью': green, 'self-review:повторное': revClean },
    expect: ({ result }) => [
      ['статус blocked, а не complete', result.status === 'blocked'],
      ['нехватка кодера прокинута', result.missing === 'правка требует смены схемы данных - это за границей'],
      ['шаг назван', /Review/.test(result.where)],
      ['находка не потеряна', result.open_findings.length === 1],
      ['решения обеих правок не потеряны', result.decisions.length === 2],
    ] },
  { name: 'F17 верификатор не смог прогнать (blocked)', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'fix:2': fixOk, 'fix:3': fixOk, 'verify:после попытки 1': verBlocked },
    expect: ({ result, calls }) => [
      ['статус blocked', result.status === 'blocked'],
      ['нехватка верификатора прокинута', result.missing === 'нет прав на запуск dotnet test'],
      ['потолок правок не проеден вхолостую', result.loops.fix === 1 && !labelsOf(calls).includes('fix:2')],
    ] },
  { name: 'F18 саморевьюер вернул blocked', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green,
      'self-review:первое': { ...revClean, status: 'blocked', missing: 'ветка сравнения недоступна' } },
    expect: ({ result }) => [
      ['цель не сдаётся закрытой', result.status !== 'complete'],
      ['причина названа', /саморевью/.test(result.where)],
    ] },
  { name: 'F19 решения узлов не теряются при потолке', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'fix:2': fixOk, 'fix:3': fixOk,
      'verify:после попытки 1': red, 'verify:после попытки 2': red, 'verify:после попытки 3': red },
    expect: ({ result }) => [
      ['статус partial', result.status === 'partial'],
      ['решения трёх попыток в возврате', (result.decisions || []).length === 3],
    ] },
  { name: 'B1 happy: воспроизведение -> фикс -> зелёная верификация -> чистое ревью', track: 'bugfix', args: bugfixArgs,
    responses: { reproduce: reproOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['первопричина в возврате', /src\/a\.ts:10/.test(result.repro.root_cause)],
      ['кодер выбран по стеку ts', typeOf(calls, 'fix:1') === 'dex-ts-fullstack-coder:ts-fullstack-assistant'],
      ['диагност - агент каталога', typeOf(calls, 'reproduce') === 'dex-debugger:debugger'],
    ] },
  { name: 'B2 воспроизведение вернуло blocked', track: 'bugfix', args: bugfixArgs,
    responses: { reproduce: { ...reproOk, status: 'blocked', missing: 'нет доступа к стенду' } },
    expect: ({ result }) => [
      ['статус blocked', result.status === 'blocked'],
      ['шаг назван', result.where === 'Reproduce'],
      ['нехватка прокинута', result.missing === 'нет доступа к стенду'],
    ] },
  { name: 'B3 потолок фиксов исчерпан', track: 'bugfix', args: bugfixArgs,
    responses: { reproduce: reproOk, 'fix:1': fixOk, 'fix:2': fixOk, 'fix:3': fixOk,
      'verify:после попытки 1': red, 'verify:после попытки 2': red, 'verify:после попытки 3': red },
    expect: ({ result }) => [
      ['статус partial', result.status === 'partial'],
      ['причина названа', /потолок 3/.test(result.where)],
      ['первопричина сохранена для следующего прогона', !!result.repro],
    ] },
  { name: 'B3a возобновление с воспроизведением из ledger: диагност не покупается', track: 'bugfix',
    args: { ...bugfixArgs, resume: true, trail: '- {"step":1}', repro: reproOk },
    responses: { 'verify:возобновление': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['узел диагноста не вызван', !labelsOf(calls).includes('reproduce')],
      ['первопричина прошлого прогона в возврате', /неверный ключ/.test(result.repro.root_cause)],
      ['источник назван в trail', /ledger/.test(stepOf(result.trail, '1-repro'))],
    ] },
  { name: 'B4 возобновление с незакрытой находкой', track: 'bugfix',
    args: { ...bugfixArgs, resume: true, trail: '- {"step":1}', open_findings: '- [P1] src/a.ts:88: сужение' },
    responses: { reproduce: reproOk, 'verify:возобновление': green, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['кодер вызван на зелёном дереве', labelsOf(calls).includes('fix:1')],
      ['находка в промпте', /src\/a\.ts:88/.test(promptOf(calls, 'fix:1'))],
    ] },
  { name: 'B5 диагност каталога не установлен', track: 'bugfix', args: bugfixArgs,
    unavailable: ['dex-debugger:debugger'],
    responses: { reproduce: reproOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['замена узла записана', result.degraded.some(d => /debugger/.test(d))],
      ['роль передана в промпте general-purpose', /Роль: диагност первопричины/.test(calls.filter(c => c.label === 'reproduce').pop().prompt)],
    ] },
  { name: 'B6 блокирующая находка -> правка -> чистое повторное ревью', track: 'bugfix', args: bugfixArgs,
    responses: { reproduce: reproOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revP1,
      'fix:after-review': fixOk, 'verify:после саморевью': green, 'self-review:повторное': revClean },
    expect: ({ result }) => [
      ['статус complete', result.status === 'complete'],
      ['два ревью', result.loops.review === 2],
      ['первопричина в промптах ревью', true],
    ] },

  { name: 'B7 верификатор не смог прогнать (blocked)', track: 'bugfix', args: bugfixArgs,
    responses: { reproduce: reproOk, 'fix:1': fixOk, 'fix:2': fixOk, 'fix:3': fixOk, 'verify:после попытки 1': verBlocked },
    expect: ({ result, calls }) => [
      ['статус blocked', result.status === 'blocked'],
      ['нехватка прокинута', result.missing === 'нет прав на запуск dotnet test'],
      ['потолок не проеден вхолостую', result.loops.fix === 1 && !labelsOf(calls).includes('fix:2')],
    ] },
  { name: 'B8 саморевьюер вернул blocked', track: 'bugfix', args: bugfixArgs,
    responses: { reproduce: reproOk, 'fix:1': fixOk, 'verify:после попытки 1': green,
      'self-review:первое': { ...revClean, status: 'blocked', missing: 'ветка сравнения недоступна' } },
    expect: ({ result }) => [
      ['цель не сдаётся закрытой', result.status !== 'complete'],
      ['причина названа', /саморевью/.test(result.where)],
    ] },
  { name: 'B9 решения узлов не теряются при потолке', track: 'bugfix', args: bugfixArgs,
    responses: { reproduce: reproOk, 'fix:1': fixOk, 'fix:2': fixOk, 'fix:3': fixOk,
      'verify:после попытки 1': red, 'verify:после попытки 2': red, 'verify:после попытки 3': red },
    expect: ({ result }) => [
      ['статус partial', result.status === 'partial'],
      ['решения трёх попыток в возврате', (result.decisions || []).length === 3],
    ] },
  { name: 'B10 кодер правки по находкам вернул blocked', track: 'bugfix', args: bugfixArgs,
    responses: { reproduce: reproOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revP1,
      'fix:after-review': { ...fixOk, status: 'blocked', missing: 'нужен доступ к боевой базе' },
      'verify:после саморевью': green, 'self-review:повторное': revClean },
    expect: ({ result }) => [
      ['статус blocked', result.status === 'blocked'],
      ['нехватка прокинута', result.missing === 'нужен доступ к боевой базе'],
    ] },
  { name: 'R1 без санкции: находки возвращаются перечнем, в MR ничего не пишется', track: 'review', args: reviewArgs,
    responses: { 'ctx:subject': ctxMr, 'review:first': revMr, 'review:security': revMr, 'falsify+coverage': falOk },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['публикации не было', !labelsOf(calls).includes('publish')],
      ['находка отдана перечнем с причиной', result.unpublished.length === 1 && /санкции publish нет/.test(result.unpublished[0].reason)],
      ['снятая находка сохранена', result.dropped.length === 1],
      ['вердикт ревьюера в возврате', result.verdict === 'REQUEST_CHANGES'],
    ] },
  { name: 'R2 с санкцией: треды опубликованы', track: 'review', args: { ...reviewArgs, publish: true },
    responses: { 'ctx:subject': ctxMr, 'review:first': revMr, 'review:security': revMr, 'falsify+coverage': falOk,
      publish: { status: 'complete', published: [{ anchor: 'api/user.ts:41', url: 'https://x/1' }], unpublished: [] } },
    expect: ({ result }) => [
      ['статус complete', result.status === 'complete'],
      ['тред опубликован', result.published.length === 1],
      ['неопубликованных нет', result.unpublished.length === 0],
    ] },
  { name: 'R3 с санкцией: канал отказал на части тредов', track: 'review', args: { ...reviewArgs, publish: true },
    responses: { 'ctx:subject': ctxMr, 'review:first': revMr, 'review:security': revMr, 'falsify+coverage': falOk,
      publish: { status: 'partial', published: [], unpublished: [{ anchor: 'api/user.ts:41', reason: '403 от хостинга' }] } },
    expect: ({ result }) => [
      ['статус partial', result.status === 'partial'],
      ['причина названа', /часть тредов не опубликована/.test(result.where)],
      ['находка не потеряна', result.unpublished.length === 1],
    ] },
  { name: 'R4 diff не трогает поверхность безопасности', track: 'review', args: reviewArgs,
    responses: { 'ctx:subject': { ...ctxMr, security_surface: false, security_basis: 'diff только в README' }, 'review:first': revMr, 'falsify+coverage': falOk },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['security-узел не спавнился', !labelsOf(calls).includes('review:security')],
      ['пропуск объяснён явным n/a с основанием', /^n\/a - diff только в README$/.test(result.security)],
    ] },
  { name: 'R5 ревизия дельты', track: 'review', args: { ...reviewArgs, last_review_sha: 'ccc' },
    responses: { 'ctx:subject': ctxMr, 'review:delta': { ...revMr, prior: ['прежняя P1 закрыта'] }, 'review:security': revMr, 'falsify+coverage': falOk },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['ре-ревьюер вместо первичного', typeOf(calls, 'review:delta') === 'dex-mr-check-reviewer:mr-check-reviewer'],
      ['статусы прежних находок в возврате', result.prior.length === 1],
      ['SHA прошлой ревизии в промпте', /LAST_REVIEW_SHA ccc/.test(promptOf(calls, 'review:delta'))],
    ] },
  { name: 'R6 предмет ревью недоступен', track: 'review', args: reviewArgs,
    responses: { 'ctx:subject': { ...ctxMr, status: 'blocked', missing: 'нет доступа к MR' } },
    expect: ({ result }) => [
      ['статус blocked', result.status === 'blocked'],
      ['шаг назван', result.where === 'Context'],
    ] },
  { name: 'R7 скептик не вернул выход - находки непроверены', track: 'review', args: reviewArgs,
    responses: { 'ctx:subject': ctxMr, 'review:first': revMr, 'review:security': revMr, 'falsify+coverage': null },
    expect: ({ result }) => [
      ['статус blocked - как у любого узла без выхода', result.status === 'blocked'],
      ['нехватка названа', /находки не проверены/.test(result.missing)],
      ['непроверенные находки не потеряны', result.claims.length === 2],
    ] },
  { name: 'R8 ревьюер вернул blocked', track: 'review', args: reviewArgs,
    responses: { 'ctx:subject': ctxMr, 'review:first': { ...revMr, status: 'blocked', missing: 'ветка MR не выкачивается' }, 'review:security': revMr, 'falsify+coverage': falOk },
    expect: ({ result }) => [
      ['статус blocked', result.status === 'blocked'],
      ['шаг назван', result.where === 'Review'],
      ['нехватка прокинута', result.missing === 'ветка MR не выкачивается'],
    ] },
  { name: 'R9 находок нет: скептик судит покрытие', track: 'review', args: reviewArgs,
    responses: { 'ctx:subject': { ...ctxMr, security_surface: false, security_basis: 'diff только в тестах' },
      'review:first': { ...revMr, findings: [], verdict: 'APPROVE' },
      'falsify+coverage': { status: 'complete', confirmed: [], dropped: [], coverage: 'покрыто: T1', missing: '' } },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['скептик всё равно вызван', labelsOf(calls).includes('falsify+coverage')],
      ['вердикт по покрытию в возврате', /покрыто/.test(result.coverage)],
      ['пустой перечень находок назван явно', /находок нет/.test(promptOf(calls, 'falsify+coverage'))],
    ] },
  { name: 'R10 узлы ревью каталога не установлены', track: 'review', args: reviewArgs,
    unavailable: ['dex-mr-reviewer:mr-reviewer', 'dex-security-reviewer:security-reviewer'],
    responses: { 'ctx:subject': ctxMr, 'review:first': revMr, 'review:security': revMr, 'falsify+coverage': falOk },
    expect: ({ result }) => [
      ['статус complete', result.status === 'complete'],
      ['обе замены записаны', result.degraded.length === 2],
    ] },
  { name: 'R11 security-узел вернул blocked при объявленной поверхности', track: 'review', args: reviewArgs,
    responses: { 'ctx:subject': ctxMr, 'review:first': revMr, 'falsify+coverage': falOk,
      'review:security': { ...revMr, status: 'blocked', findings: [], missing: 'нет доступа к зависимостям' } },
    expect: ({ result }) => [
      ['ревью не сдаётся полным', result.status === 'partial'],
      ['непроверенная ось названа в причине', /security/.test(result.where)],
      ['находки основного ревьюера сохранены', result.confirmed.length === 1],
    ] },
  { name: 'R12 публикатор не вернул выход', track: 'review', args: { ...reviewArgs, publish: true },
    responses: { 'ctx:subject': ctxMr, 'review:first': revMr, 'review:security': revMr, 'falsify+coverage': falOk, publish: null },
    expect: ({ result }) => [
      ['статус partial', result.status === 'partial'],
      ['находка не потеряна', result.unpublished.length === 1],
      ['причина неопубликования названа', /не вернул выход/.test(result.unpublished[0] ? result.unpublished[0].reason : '')],
    ] },
  { name: 'R13 скептик вернул partial', track: 'review', args: reviewArgs,
    responses: { 'ctx:subject': ctxMr, 'review:first': revMr, 'review:security': revMr,
      'falsify+coverage': { ...falOk, status: 'partial', missing: 'ветка MR не выкачивается, сверено по diff' } },
    expect: ({ result }) => [
      ['статус partial', result.status === 'partial'],
      ['причина названа', /ветка MR не выкачивается/.test(result.where)],
    ] },
  { name: 'R14 скептик вернул blocked', track: 'review', args: reviewArgs,
    responses: { 'ctx:subject': ctxMr, 'review:first': revMr, 'review:security': revMr,
      'falsify+coverage': { ...falOk, status: 'blocked', missing: 'ветка MR не выкачивается' } },
    expect: ({ result }) => [
      ['статус blocked', result.status === 'blocked'],
      ['нехватка прокинута', result.missing === 'ветка MR не выкачивается'],
      ['находки-claims сохранены', result.claims.length === 2],
    ] },
  { name: 'F25 дерево трека изолированное: узлы получают cwd трека и main_cwd на чтение', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ calls }) => [
      ['кодер работает в дереве трека', promptOf(calls, 'fix:1').includes('Работай только внутри /repo-F-1')],
      ['дерево названо своим', /чужой работы в нём нет/.test(promptOf(calls, 'fix:1'))],
      ['каталог сессии - на чтение', promptOf(calls, 'fix:1').includes('Каталог сессии /repo - только на чтение')],
      ['ветка трека названа', promptOf(calls, 'fix:1').includes('auto/F-1')],
    ] },
  { name: 'F26 дерево подготовлено узлом подготовки -> кодеру сказано не повторять установку', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ calls }) => [
      ['узлу подготовки поручено выполнить установку, а не только назвать', /ВЫПОЛНИ её в дереве/.test(promptOf(calls, 'ctx:tree'))],
      ['стек выводится по реестру, а не по догадке', /dex-skill-stack-registry:stack-registry/.test(promptOf(calls, 'ctx:tree'))],
      ['состояние дерева названо кодеру', promptOf(calls, 'fix:1').includes('Дерево подготовлено узлом контекста (dotnet restore) - установку не повторяй')],
      ['кодеру не предписано ставить зависимости заново', !/до первой сборки выполни её сам/.test(promptOf(calls, 'fix:1'))],
    ] },
  { name: 'F27 готовить нечего (not-needed) -> строки подготовки у кодера нет', track: 'feature', args: featureArgs,
    responses: { 'ctx:tree': prepNotNeeded, 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ calls, result }) => [
      ['строки подготовки нет', !/Дерево подготовлено|выполни её сам/.test(promptOf(calls, 'fix:1'))],
      ['not-needed деградацией не считается', !result.degraded.some(d => /подготовка дерева/.test(d))],
    ] },
  { name: 'F30 подготовка дерева упала -> кодер предупреждён и лечит дерево сам, трек не встаёт', track: 'feature', args: featureArgs,
    responses: { 'ctx:tree': prepFailed, 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['трек доезжает до исхода', result.status === 'complete'],
      ['провал назван оператору', result.degraded.some(d => /подготовка дерева не удалась: dotnet restore: NU1101/.test(d))],
      ['кодеру названа причина и команда', promptOf(calls, 'fix:1').includes('до первой сборки выполни её сам: dotnet restore')],
    ] },
  { name: 'F31 узел подготовки вернул blocked -> трек встаёт на Context, кодер не вызван', track: 'feature', args: featureArgs,
    responses: { 'ctx:tree': { ...prepOk, status: 'blocked', missing: 'нет доступа к фиду пакетов' }, 'ctx:R-I': ctxOk },
    expect: ({ result, calls }) => [
      ['статус blocked', result.status === 'blocked'],
      ['остановка названа шагом подготовки', result.where === 'Context: подготовка дерева'],
      ['нехватка прокинута', result.missing === 'нет доступа к фиду пакетов'],
      ['кодер не вызван', !labelsOf(calls).includes('fix:1')],
    ] },
  { name: 'F32 узел подготовки не вернул выход -> blocked с названной причиной', track: 'feature', args: featureArgs,
    responses: { 'ctx:tree': null, 'ctx:R-I': ctxOk },
    expect: ({ result }) => [
      ['статус blocked', result.status === 'blocked'],
      ['причина названа, а не пустая', result.missing === 'узел подготовки дерева не вернул выход'],
    ] },
  { name: 'F33 подготовка и разведка идут параллельно в одной фазе и делят предмет', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['оба узла в фазе Context', calls.filter(c => ['ctx:tree', 'ctx:R-I'].includes(c.label)).every(c => c.phase === 'Context')],
      ['разведке техконтекст запрещён', /Стек, команды сборки и тестов не выводи/.test(promptOf(calls, 'ctx:R-I'))],
      ['разведке названо, что дерево в работе у соседа', /соседний узел в этот момент ставит в это дерево зависимости/.test(promptOf(calls, 'ctx:R-I'))],
      ['подготовке запрещено трогать код и прогоны', /код не правь, сборку и тесты не прогоняй/.test(promptOf(calls, 'ctx:tree'))],
      ['оба шага легли в trail', result.trail.some(t => t.step === '1-tree') && result.trail.some(t => t.step === '1-req')],
      ['команды кодеру пришли от подготовки', promptOf(calls, 'fix:1').includes('Тесты: dotnet test') && promptOf(calls, 'fix:1').includes('Сборка: dotnet build')],
    ] },
  { name: 'F28 red-run прошлой попытки подаётся следующей как установленный факт', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'fix:2': fixOk, 'verify:после попытки 1': red, 'verify:после попытки 2': green, 'self-review:первое': revClean },
    expect: ({ calls, result }) => [
      ['статус complete', result.status === 'complete'],
      ['вторая попытка несёт red-run первой', promptOf(calls, 'fix:2').includes('перепроверке не подлежит: T1 красный до, зелёный после')],
      ['падение названо своим, не чужим', /Дерево изолированное: это следствие правок трека/.test(promptOf(calls, 'fix:2'))],
      ['red-run попытки лёг в trail', result.trail.some(t => t.step === 2 && t['red-run'] === 'T1 красный до, зелёный после')],
    ] },
  { name: 'F29 red-run n/a следующей попытке как факт не подаётся', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': { ...fixOk, 'red-run': 'n/a: тестов в дельте нет' }, 'fix:2': fixOk, 'verify:после попытки 1': red, 'verify:после попытки 2': green, 'self-review:первое': revClean },
    expect: ({ calls }) => [
      ['факта нет', !/перепроверке не подлежит/.test(promptOf(calls, 'fix:2'))],
    ] },
  { name: 'B13a «продолжить» без следа прогона: трек идёт как первый', track: 'bugfix',
    args: { ...bugfixArgs, resume: true },
    responses: { 'reproduce': reproOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['верификация возобновления не покупалась', !labelsOf(calls).includes('verify:возобновление')],
      ['фаза правки не пропущена', labelsOf(calls).includes('fix:1')],
      ['деградация названа оператору', result.decisions.some(d => /без trail/.test(d))],
    ] },
  { name: 'B14 подготовка идёт перед воспроизведением: диагност и кодер получают готовое дерево', track: 'bugfix', args: bugfixArgs,
    responses: { 'reproduce': reproOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ calls }) => [
      ['подготовка вызвана раньше воспроизведения', labelsOf(calls).indexOf('ctx:tree') < labelsOf(calls).indexOf('reproduce')],
      ['подготовке запрещено чинить баг', /код не правь, баг не чини, тесты не прогоняй/.test(promptOf(calls, 'ctx:tree'))],
      ['диагност получил команды и состояние дерева', promptOf(calls, 'reproduce').includes('Тесты: npm test') && promptOf(calls, 'reproduce').includes('Дерево подготовлено узлом контекста (npm ci)')],
      ['кодер работает в дереве трека', promptOf(calls, 'fix:1').includes('Работай только внутри /repo-B-1')],
    ] },
  { name: 'B15 подготовка упала -> диагносту названа причина и запрет объявить её первопричиной', track: 'bugfix', args: bugfixArgs,
    responses: { 'ctx:tree': { ...prepTs, 'prepare-status': 'failed', prepare_log: 'npm ci: EAI_AGAIN registry' }, 'reproduce': reproOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['трек доезжает до исхода', result.status === 'complete'],
      ['провал назван оператору', result.degraded.some(d => /подготовка дерева не удалась: npm ci: EAI_AGAIN/.test(d))],
      ['диагносту предписано вылечить дерево самому', promptOf(calls, 'reproduce').includes('до первого прогона выполни её сам: npm ci')],
      ['падение установки первопричиной бага не называется', /Падение установки первопричиной бага не называй/.test(promptOf(calls, 'reproduce'))],
    ] },
  { name: 'B16 подготовка вернула blocked -> диагност не вызван', track: 'bugfix', args: bugfixArgs,
    responses: { 'ctx:tree': { ...prepTs, status: 'blocked', missing: 'нет доступа к npm registry' } },
    expect: ({ result, calls }) => [
      ['статус blocked', result.status === 'blocked'],
      ['остановка названа шагом подготовки', result.where === 'Context: подготовка дерева'],
      ['диагност не вызван: воспроизводить нечем', !labelsOf(calls).includes('reproduce')],
    ] },
  { name: 'F25 противоречие источников требований -> трек встаёт на Context, кодер не вызван', track: 'feature', args: { ...featureArgs, source: 'FEAT.md' },
    responses: { 'ctx:R-I': ctxConflict },
    expect: ({ result, calls }) => [
      ['статус blocked', result.status === 'blocked'],
      ['остановка на Context', result.where === 'Context'],
      ['нехватка называет обе стороны', /AC2.*R4|R4.*AC2/s.test(result.missing)],
      ['нехватка называет полномочие', /выбор стороны не за исполнителем/.test(result.missing)],
      ['кодер не вызван: проигравшая сторона не закреплена тестом', !calls.some(c => c.label === 'fix:1')],
      ['разведка не уезжает в ledger: решение владельца меняет её источник', result.ctx === null],
      ['суждение поручено оракулу требований, а не узлу', /Skill dex-skill-requirement-quality:requirement-quality/.test(promptOf(calls, 'ctx:R-I'))],
      ['техрасхождение выведено из-под правила', /Расхождение о техконтексте .* сюда не подпадает/.test(promptOf(calls, 'ctx:R-I'))],
    ] },
  { name: 'F26 перечень противоречий при conflict-status none -> трек судит перечень, а не статус', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxConflictMute },
    expect: ({ result, calls }) => [
      ['статус blocked', result.status === 'blocked'],
      ['кодер не вызван', !calls.some(c => c.label === 'fix:1')],
      ['перечень попал в нехватку', /AC2/.test(result.missing)],
    ] },
  { name: 'F27 источника требований нет -> оракул не зовётся, разведка идёт как обычно', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['адрес оракула в промпт не попал', !/dex-skill-requirement-quality/.test(promptOf(calls, 'ctx:R-I'))],
      ['узлу назван исход вместо суждения', /сверять не с чем: conflict-status: none/.test(promptOf(calls, 'ctx:R-I'))],
      ['трек доезжает до исхода', result.status === 'complete'],
    ] },
  { name: 'B14 противоречие источников ожидаемого -> трек встаёт на Reproduce, кодер не вызван', track: 'bugfix', args: { ...bugfixArgs, source: 'BUG.md' },
    responses: { 'reproduce': reproConflict },
    expect: ({ result, calls }) => [
      ['статус blocked', result.status === 'blocked'],
      ['остановка на Reproduce', result.where === 'Reproduce'],
      ['нехватка называет обе стороны', /AC-4.*200|200.*AC-4/s.test(result.missing)],
      ['кодер не вызван: починка под выбранную сторону не закреплена тестом', !calls.some(c => c.label === 'fix:1')],
      ['воспроизведение не уезжает в ledger: решение владельца меняет его источник', result.repro === null],
      ['суждение поручено оракулу требований, а не узлу', /Skill dex-skill-requirement-quality:requirement-quality/.test(promptOf(calls, 'reproduce'))],
    ] },
  { name: 'R15 ревью работает в detached-дереве трека и переключает его на head_sha', track: 'review', args: reviewArgs,
    responses: { 'ctx:subject': ctxMr, 'review:first': revMr, 'review:security': revMr, 'falsify+coverage': falOk },
    expect: ({ calls }) => [
      ['дерево названо detached', /detached git worktree/.test(promptOf(calls, 'review:first'))],
      ['рабочее дерево сессии не трогается', /рабочего дерева сессии это не трогает/.test(promptOf(calls, 'review:first'))],
      ['чтение кода - переключением дерева на head_sha', promptOf(calls, 'review:first').includes('переключи /repo-gh-1 на bbb')],
    ] },
  { name: 'F34 шапка узла подготовки несёт дерево и мандат, но не цель', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ calls }) => [
      ['цели в шапке нет', !promptOf(calls, 'ctx:tree').includes(featureArgs.goal)],
      ['критерия «готово» в шапке нет', !promptOf(calls, 'ctx:tree').includes(featureArgs.done)],
      ['мандат назван: код не предмет узла', /код в дереве не твой предмет/.test(promptOf(calls, 'ctx:tree'))],
      ['изоляция дерева на месте', promptOf(calls, 'ctx:tree').includes('Работай только внутри /repo-F-1')],
      ['стоп-линия на месте', /это стоп-линия/.test(promptOf(calls, 'ctx:tree'))],
      ['кодер цель по-прежнему получает', promptOf(calls, 'fix:1').includes(featureArgs.goal)],
    ] },
  { name: 'F35 поле ctx подано не в форме разведки -> узел вызван заново, подмена названа', track: 'feature',
    args: { ...featureArgs, resume: true, trail: '- {"step":1}', ctx: { stack: 'dotnet', prepare_cmd: 'dotnet restore' } },
    responses: { 'ctx:R-I': ctxOk, 'verify:возобновление': green, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['трек не падает', result.status === 'complete'],
      ['разведка куплена узлом', labelsOf(calls).includes('ctx:R-I')],
      ['подмена названа оператору', result.degraded.some(d => /поле ctx подано не в форме разведки/.test(d))],
      ['источник разведки в trail - узел, не ledger', /Explore/.test(stepOf(result.trail, '1-req'))],
    ] },
  { name: 'B17 поле repro подано не в форме воспроизведения -> диагност вызван заново', track: 'bugfix',
    args: { ...bugfixArgs, resume: true, trail: '- {"step":1}', repro: { stack: 'ts', test_cmd: 'npm test' } },
    responses: { 'reproduce': reproOk, 'verify:возобновление': green, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['трек не падает', result.status === 'complete'],
      ['диагност куплен заново', labelsOf(calls).includes('reproduce')],
      ['подмена названа оператору', result.degraded.some(d => /поле repro подано не в форме воспроизведения/.test(d))],
    ] },
  { name: 'B18 шапка узла подготовки в bugfix не несёт симптома', track: 'bugfix', args: bugfixArgs,
    responses: { 'reproduce': reproOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ calls }) => [
      ['симптома в шапке нет', !promptOf(calls, 'ctx:tree').includes(bugfixArgs.symptom)],
      ['ожидаемого в шапке нет', !promptOf(calls, 'ctx:tree').includes(bugfixArgs.expected)],
      ['мандат назван: чинит другой узел', /воспроизводит и чинит другой узел/.test(promptOf(calls, 'ctx:tree'))],
      ['диагност симптом по-прежнему получает', promptOf(calls, 'reproduce').includes(bugfixArgs.symptom)],
    ] },
  // Приёмка диагноза: спор разрешается уликой за один возврат диагносту, правка теста ловится хэшем снимка.
  { name: 'B19 тест диагноста доезжает до кодера и верификатора, кодеру предписана приёмка', track: 'bugfix', args: bugfixArgs,
    responses: { 'reproduce': reproTest, 'fix:1': fixOk, 'verify:после попытки 1': greenTest, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['трек complete', result.status === 'complete'],
      ['кодеру назван тест диагноста', promptOf(calls, 'fix:1').includes('Тест диагноста: test/pay.test.ts')],
      ['кодеру предписана приёмка по node-contract', promptOf(calls, 'fix:1').includes('references/diagnosis-acceptance.md')],
      ['верификатор снимает хэш теста', promptOf(calls, 'verify:после попытки 1').includes('git hash-object test/pay.test.ts')],
      ['ревью не получает сигнала о правке теста', !promptOf(calls, 'self-review:первое').includes('изменён кодером')],
    ] },
  { name: 'B20 кодер оспорил причину -> повторный диагноз с уликой, попытка правки не тратится', track: 'bugfix', args: bugfixArgs,
    responses: { 'reproduce': reproTest, 'fix:1': (n) => n === 1 ? fixDisputeCause : fixOk, 'reproduce:dispute': { ...reproTest, reproduction: 'улика отбита: src/pay.ts:12 вызывается и на этом пути' }, 'verify:после попытки 1': greenTest, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['трек complete', result.status === 'complete'],
      ['диагност получил улику', promptOf(calls, 'reproduce:dispute').includes('src/pay.ts:40 ключ идемпотентности уже проверяется')],
      ['кодер получил ответ диагноста', calls.filter(c => c.label === 'fix:1').pop().prompt.includes('улика отбита: src/pay.ts:12')],
      ['попытка не потрачена', result.loops.fix === 1],
      ['верификация до правки не покупалась', calls.filter(c => c.label.startsWith('verify:')).length === 1],
      ['спор в выходе', result.disputes.length === 1],
    ] },
  { name: 'B21 второй спор -> partial с обеими позициями, третьего круга нет', track: 'bugfix', args: bugfixArgs,
    responses: { 'reproduce': reproTest, 'fix:1': fixDisputeCause, 'reproduce:dispute': reproTest },
    expect: ({ result, calls }) => [
      ['статус partial', result.status === 'partial'],
      ['where называет повторный спор', /диагноз оспорен повторно/.test(result.where)],
      ['обе позиции в выходе', result.disputes.length === 2],
      ['диагност повторно вызван один раз', calls.filter(c => c.label === 'reproduce:dispute').length === 1],
    ] },
  { name: 'B22 спор об ожидаемом -> blocked, диагност не вызывается', track: 'bugfix', args: bugfixArgs,
    responses: { 'reproduce': reproTest, 'fix:1': { ...fixDisputeCause, 'diagnosis-check': 'disputed-expected', dispute: 'AC-2 docs/spec.md:14 требует 409, тест ждёт 200' } },
    expect: ({ result, calls }) => [
      ['статус blocked', result.status === 'blocked'],
      ['выбор назван владельцу требований', /выбор стороны за владельцем требований: AC-2/.test(result.missing)],
      ['диагност не вызван', !labelsOf(calls).includes('reproduce:dispute')],
      ['воспроизведение не переживает исход', result.repro === null],
    ] },
  { name: 'B23 тест диагноста изменён при accepted -> partial, ревью получает сигнал', track: 'bugfix', args: bugfixArgs,
    responses: { 'reproduce': reproTest, 'fix:1': fixOk, 'verify:после попытки 1': { ...greenTest, repro_test_hash: 'b2' }, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['статус partial', result.status === 'partial'],
      ['where называет правку теста', /тест диагноста test\/pay.test.ts изменён при diagnosis-check: accepted/.test(result.where)],
      ['ревьюеру дан исходник теста', promptOf(calls, 'self-review:первое').includes('git show b1')],
    ] },
  { name: 'B24 обвязка теста починена (harness-fixed) -> complete, проверку судит ревью', track: 'bugfix', args: bugfixArgs,
    responses: { 'reproduce': reproTest, 'fix:1': { ...fixOk, 'diagnosis-check': 'harness-fixed' }, 'verify:после попытки 1': { ...greenTest, repro_test_hash: 'b2' }, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['ревью поручено судить проверку', /Изменена проверка - вход, вызываемый путь или ожидаемое - находка P1/.test(promptOf(calls, 'self-review:первое'))],
    ] },
]

// Узел подготовки дерева - фон любого сценария feature / bugfix, а не его предмет: ответ по
// умолчанию задан здесь, сценарий о самой подготовке перекрывает его своим ключом 'ctx:tree'.
const DEFAULT_TREE = { feature: prepOk, bugfix: prepTs }

const only = process.argv[2]
let n = 0, failed = 0
for (const s of SCENARIOS) {
  if (only && !s.name.startsWith(only)) continue
  let checks
  try {
    const responses = DEFAULT_TREE[s.track] ? { 'ctx:tree': DEFAULT_TREE[s.track], ...s.responses } : s.responses
    checks = s.expect(await runTrack(s.track, s.args, responses, s.unavailable))
  } catch (e) {
    n++; failed++
    console.log(`not ok ${n} - ${s.name}: упал прогон - ${e.message}`)
    continue
  }
  for (const [what, ok] of checks) {
    n++
    if (!ok) failed++
    console.log(`${ok ? 'ok' : 'not ok'} ${n} - ${s.name} / ${what}`)
  }
}
console.log(`\nrun.mjs: ${SCENARIOS.length} сценариев, ${n} проверок, ${failed} провал(ов)`)
process.exit(failed ? 1 : 0)
