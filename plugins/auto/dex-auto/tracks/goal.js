// Проба черновика цели /goal (docs/tracks/goal.md); не трек: ничего не пишет, вход args { kind, corpus, cwd }.
export const meta = {
  name: 'dex-auto-goal',
  description: 'Проба черновика цели feature: домыслы goal-reader с меткой нарушения источника - главному потоку на деление',
  phases: [
    { title: 'Probe', detail: 'goal-reader: план будущей реализации, обещания свойством, трасса источника в черновик, пробелы и домыслы - решения, снимающие пробелы, расхождения трассы и развилки без ответа в черновике и источнике' },
  ],
}

const A = args && typeof args === 'object' ? args : {}
const degraded = []

// >>> shared: contract
const STATUS = { type: 'string', enum: ['complete', 'blocked', 'partial'] }
const VERDICT = { type: 'string', enum: ['APPROVE', 'REQUEST_CHANGES', 'NEEDS_DISCUSSION'] }
const lack = (v, who) => !v ? `${who} не вернул выход` : v.missing || `${who} вернул blocked без нехватки`
// Трек виден в списке / и зовётся без args: узлы с правом записи на пустом cwd работали бы в дереве сессии.
const unfed = (A, fields) => fields.filter(f => !String(A[f] ?? '').trim())
const why = (e) => String(e && e.message || e).slice(0, 300)
// <<< shared: contract
// >>> shared: nodes
// Цену узла ставит трек, frontmatter узла её не несёт; запись без model и effort - уровень сессии.
const NODE = {
  // sonnet - модель пробы в прогонах P76-P86.
  'goal-reader': { agentType: 'dex-auto:goal-reader', model: 'sonnet' },
  // opus - модель контроля dex-self-reviewer: сверка P74 различает норму, а не модель.
  reviewer: { agentType: 'dex-auto:reviewer', model: 'opus' },
  // без model - замера модели скептика нет (#289).
  skeptic: { agentType: 'dex-auto:skeptic' },
  // sonnet - модель кодеров каталога: сверка P75 различает норму, а не модель.
  coder: { agentType: 'dex-auto:coder', model: 'sonnet' },
  // opus - модель контроля dex-debugger: сверка P91 различает норму, а не модель.
  debugger: { agentType: 'dex-auto:debugger', model: 'opus' },
  // sonnet - узел исполняет публикацию по каналу хостинга, суждения о коде у него нет.
  deliverer: { agentType: 'dex-auto:deliverer', model: 'sonnet' },
}
// <<< shared: nodes

// Смысл полей - в файле узла (agents/goal-reader.md), схема держит только форму.
const STR = { type: 'string' }
const LIST = { type: 'array', items: STR }
const NUMS = { type: 'array', items: { type: 'integer' } }
const TRACE = { type: 'object', properties: { where: STR, delivery: STR, diff: STR, kind: { type: 'string', enum: ['breaks', 'refines'] } },
  required: ['where', 'delivery', 'diff', 'kind'] }
const GAP = { type: 'object', properties: { where: STR, gap: STR }, required: ['where', 'gap'] }
const GUESS = { type: 'object', properties: { where: STR, decision: STR, cost: STR, covers: NUMS, traces: NUMS },
  required: ['where', 'decision', 'cost', 'covers', 'traces'] }
const PROBE = { type: 'object', properties: { status: STATUS, plan: LIST, promises: LIST, trace: { type: 'array', items: TRACE }, gaps: { type: 'array', items: GAP }, guesses: { type: 'array', items: GUESS }, open_items: LIST, missing: STR },
  required: ['status', 'plan', 'promises', 'trace', 'gaps', 'guesses', 'open_items', 'missing'] }
const INPUT = `Черновик цели - ${A.corpus}/goal.md, её источник - ${A.corpus}/source.md, код проекта - ${A.cwd}.`
const done = (probe, reason, extra) => ({ probe, reason, questions: [], open_items: [], degraded, ...extra })

if (A.kind === 'bugfix') return done('n/a', 'вид bugfix: проба только для feature')
const noPath = ['corpus', 'cwd'].filter(k => !A[k] || typeof A[k] !== 'string')
const shape = typeof args === 'string' ? 'args строкой, а не объектом'
  : A.kind !== 'feature' ? `вид ${A.kind === undefined ? 'не задан' : `«${A.kind}»`}, ждали feature либо bugfix`
  : noPath.length ? `пусто либо не строка: ${noPath.join(', ')}` : ''
if (shape) return done('unverifiable', `вход пробы не разобран: ${shape}`)

phase('Probe')
let p
try {
  p = await agent(INPUT, { label: 'probe', phase: 'Probe', schema: PROBE, ...NODE['goal-reader'] })
} catch (e) {
  return done('unverifiable', `узел пробы ${NODE['goal-reader'].agentType} не отработал: ${why(e)}`)
}
if (!p) return done('unverifiable', 'узел пробы не вернул выход')
if (p.status === 'blocked') return done('unverifiable', lack(p, 'узел пробы'))
const isObj = (v) => v && typeof v === 'object'
const gaps = (p.gaps || []).filter(isObj)
// Строка трассы без различия - пустой diff либо «нет»: модель пишет его вместо пустой строки.
const trace = (p.trace || []).filter(isObj).map(t => ({ ...t, diff: /^\s*(нет|-)?\s*$/i.test(String(t.diff || '')) ? '' : String(t.diff) }))
const strayG = new Set(), strayT = new Set(), coveredG = new Set(), coveredT = new Set()
const pick = (nums, ok, used, stray) => [...new Set(Array.isArray(nums) ? nums : [])].filter(n => {
  const v = Number.isInteger(n) && ok(n)
  v ? used.add(n) : stray.add(n)
  return v
})
const found = (p.guesses || []).filter(isObj).map(g => ({ ...g,
  covers: pick(g.covers, n => n >= 1 && n <= gaps.length, coveredG, strayG),
  traces: pick(g.traces, n => n >= 1 && n <= trace.length && !!trace[n - 1].diff, coveredT, strayT),
}))
const bareG = gaps.map((_, i) => i + 1).filter(n => !coveredG.has(n))
const bareT = trace.map((t, i) => t.diff && i + 1).filter(n => n && !coveredT.has(n))
if (strayG.size) degraded.push(`домыслы ссылаются на пробелы вне списка: ${[...strayG].join(', ')} - сняты`)
if (strayT.size) degraded.push(`домыслы ссылаются на строки трассы без расхождения: ${[...strayT].join(', ')} - сняты`)
if (bareT.length) degraded.push(`расхождения трассы ${bareT.join(', ')} не покрыты домыслом пробы - вопросом как есть`)
if (bareG.length) degraded.push(`пробелы ${bareG.join(', ')} не покрыты домыслом пробы - вопросом как есть`)
// Нарушение источника из кода не выводится: код показывает, что есть, а не что просил источник (P57).
const breaks = (g) => g.traces.some(n => trace[n - 1].kind !== 'refines')
// Нарушение источника первым - хвост очереди за потолком ревизий уходит допущением; затем решение, снимающее
// больше пробелов и расхождений: ответ на него закрывает постановку быстрее всего.
const weight = (g) => g.covers.length + g.traces.length
const guesses = [...found,
  ...bareT.map(n => ({ where: trace[n - 1].where, decision: trace[n - 1].diff, cost: '', covers: [], traces: [n] })),
  ...bareG.map(n => ({ where: gaps[n - 1].where, decision: gaps[n - 1].gap, cost: '', covers: [n], traces: [] }))]
  .map((g, i) => ({ g, i })).sort((a, b) => breaks(b.g) - breaks(a.g) || weight(b.g) - weight(a.g) || a.i - b.i)
  .map(({ g }, i) => ({ ...g, id: `D${i + 1}`, gaps: [...g.covers.map(n => gaps[n - 1].gap), ...g.traces.map(n => trace[n - 1].diff)] }))
const open = (p.open_items || []).filter(Boolean)
if (!guesses.length && !open.length) {
  if (p.status === 'partial') return done('unverifiable', `проба partial без домыслов: ${p.missing || 'нехватка не названа'}`)
  return done('passed', '')
}
if (p.status === 'partial') degraded.push(`проба partial: ${p.missing || 'нехватка не названа'}`)
return done('failed', '', { open_items: open, questions: guesses.map(g => ({ id: g.id, where: g.where, decision: g.decision, cost: g.cost, gaps: g.gaps, breaks: breaks(g) })) })
