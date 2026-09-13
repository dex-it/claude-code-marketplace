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
    return value === undefined ? null : value
  }
  const parallel = (fns) => Promise.all(fns.map(f => f()))
  const pipeline = async (items, a, b) => Promise.all(items.map(async i => b(await a(i))))
  const fn = new AsyncFunction('args', 'agent', 'parallel', 'pipeline', 'phase', 'log', src)
  const result = await fn(args, agent, parallel, pipeline, () => {}, () => {})
  return { result, calls }
}

const green = { status: 'complete', exit_code: 0, pass_count: 9, fail_count: 0, failing: [], build_ok: true, head: 'abc feat', dirty: false }
const red = { ...green, exit_code: 1, fail_count: 2, failing: ['T1', 'T2'], head: 'abc wip' }
const dirty = { ...green, dirty: true }
const ctxOk = { status: 'complete', stack: 'dotnet', requirements: ['R1 ...'], files: ['src/A.cs'], test_cmd: 'dotnet test', build_cmd: 'dotnet build', corpus: 'docs/', missing: '' }
const reproOk = { status: 'complete', stack: 'ts', root_cause: 'src/a.ts:10 неверный ключ', reproduction: 'тест T1: красный', expected_basis: 'тест', fix_proposal: 'править ключ', files: ['src/a.ts'], test_cmd: 'npm test', build_cmd: 'tsc', missing: '' }
const fixOk = { status: 'complete', changed_files: ['src/A.cs'], commit: 'abc123', red_run: 'T1 красный до, зелёный после', decisions: ['выбран A'], missing: '' }
const revClean = { status: 'complete', findings: [], run_status: 'build ok, tests 9/9', push_recommended: true, push_blockers: '' }
const revP1 = { status: 'complete', findings: [{ severity: 'P1', anchor: 'src/A.cs:8', text: 'ретрай не различает случаи' }], run_status: 'build ok', push_recommended: false, push_blockers: 'открыта P1' }
const revP2 = { status: 'complete', findings: [{ severity: 'P2', anchor: 'src/A.cs:9', text: 'имя переменной' }], run_status: 'build ok', push_recommended: true, push_blockers: '' }
const verBlocked = { status: 'blocked', exit_code: -1, pass_count: 0, fail_count: 0, failing: [], build_ok: false, head: '', dirty: false, missing: 'нет прав на запуск dotnet test' }
const ctxMr = { status: 'complete', platform: 'github', base_sha: 'aaa', head_sha: 'bbb', files: ['api/user.ts'], security_surface: true, security_basis: 'diff трогает auth', intent: 'issue #12', missing: '' }
const mrFinding = { anchor: 'api/user.ts:41', severity: 'P1', axis: 'security', text: 'токен в логе', closure: 'убрать поле', evidence: 'logger.info(ctx)' }
const revMr = { status: 'complete', findings: [mrFinding], axes: ['language: чисто'], verdict: 'REQUEST_CHANGES', prior: [], questions: ['вопрос по намерению'], missing: '' }
const falOk = { status: 'complete', confirmed: [mrFinding], dropped: [{ anchor: 'api/db.ts:7', reason: 'закрыто соседним коммитом' }], coverage: 'ветка X непокрыта', missing: '' }

const featureArgs = { task: 'F-1', goal: 'цель', done: 'npm test -> 0', boundary: 'не трогать схему', mode: 'autonomous', cwd: '/repo' }
const bugfixArgs = { task: 'B-1', symptom: 'дубль платежа', expected: 'один платёж', env: 'staging', done: 'npm test -> 0', mode: 'autonomous', cwd: '/repo' }
const reviewArgs = { task: 'gh-1', mr: 'owner/repo#7', intent: 'issue #12', mode: 'autonomous', cwd: '/repo' }

const labelsOf = (calls) => calls.map(c => c.label)
const promptOf = (calls, label) => (calls.find(c => c.label === label) || {}).prompt || ''
const typeOf = (calls, label) => (calls.find(c => c.label === label) || {}).agentType

const SCENARIOS = [
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
  { name: 'F12 агент-кодер каталога не установлен', track: 'feature', args: featureArgs,
    unavailable: ['dex-dotnet-coder:dotnet-coder'],
    responses: { 'ctx:R-I': ctxOk, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
    expect: ({ result, calls }) => [
      ['статус complete', result.status === 'complete'],
      ['замена узла записана', result.degraded.some(d => /dotnet-coder/.test(d))],
      ['работу доделал general-purpose', calls.filter(c => c.label === 'fix:1').pop().agentType === 'general-purpose'],
    ] },
  { name: 'F13 стек вне реестра -> кодер общего назначения без записи о деградации', track: 'feature', args: featureArgs,
    responses: { 'ctx:R-I': { ...ctxOk, stack: 'other' }, 'fix:1': fixOk, 'verify:после попытки 1': green, 'self-review:первое': revClean },
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
]

const only = process.argv[2]
let n = 0, failed = 0
for (const s of SCENARIOS) {
  if (only && !s.name.startsWith(only)) continue
  let checks
  try {
    checks = s.expect(await runTrack(s.track, s.args, s.responses, s.unavailable))
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
