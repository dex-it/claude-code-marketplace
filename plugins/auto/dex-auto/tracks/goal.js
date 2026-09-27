// Проба черновика цели /goal (docs/tracks/goal.md); не трек: ничего не пишет, вход args { kind, corpus, cwd }.
export const meta = {
  name: 'dex-auto-goal',
  description: 'Проба черновика цели feature: домыслы implementer-reader -> выводимые из кода с якорем, прочие - вопросом оператору',
  phases: [
    { title: 'Probe', detail: 'implementer-reader читает черновик цели и источник и выписывает домыслы' },
    { title: 'Sort', detail: 'каждый домысел - выводим из кода и корпуса проекта с якорем либо вопрос оператору' },
  ],
}

const A = args && typeof args === 'object' ? args : {}
const degraded = []

// >>> shared: contract
const STATUS = { type: 'string', enum: ['complete', 'blocked', 'partial'] }
const lack = (v, who) => !v ? `${who} не вернул выход` : v.missing || `${who} вернул blocked без нехватки`
const why = (e) => String(e && e.message || e).slice(0, 300)
// <<< shared: contract

const PROBE_NODE = 'dex-implementer-reader:implementer-reader'
const GUESS = { type: 'object', properties: {
  where: { type: 'string', description: 'место в наборе: файл и раздел' },
  decision: { type: 'string', description: 'две реализации, которые допускает набор, и чем их различит наблюдатель' },
  cost: { type: 'string', description: 'чем грозит неверный выбор' },
}, required: ['where', 'decision', 'cost'] }
const PROBE = { type: 'object', properties: {
  status: STATUS, verdict: { type: 'string', enum: ['passed', 'failed', 'unverifiable'] },
  guesses: { type: 'array', items: GUESS, description: 'список домыслов целиком' },
  open_items: { type: 'array', items: { type: 'string' }, description: 'открытые пункты, названные самим набором' },
  missing: { type: 'string' },
}, required: ['status', 'verdict', 'guesses', 'open_items', 'missing'] }
const SORT = { type: 'object', properties: {
  status: STATUS,
  items: { type: 'array', items: { type: 'object', properties: {
    id: { type: 'string' }, class: { type: 'string', enum: ['derived', 'question'] },
    answer: { type: 'string', description: 'derived - что отвечает код или корпус; question - пусто' },
    anchor: { type: 'string', description: 'derived - файл:строка, где ответ виден; question - пусто' },
  }, required: ['id', 'class', 'answer', 'anchor'] } },
  missing: { type: 'string' },
}, required: ['status', 'items', 'missing'] }
const ANCHOR = /[^\s:()]+:\d+(?:[-,]\d+)*/
const READ_ONLY = 'Читай через Read, Grep, Glob; Bash не вызывай.'
const asQuestion = ({ id, where, decision, cost }) => ({ id, where, decision, cost })
const done = (probe, reason, extra) => ({ probe, reason, derived: [], questions: [], open_items: [], degraded, ...extra })

if (A.kind === 'bugfix') return done('n/a', 'вид bugfix: проба только для feature')
const noPath = ['corpus', 'cwd'].filter(k => !A[k] || typeof A[k] !== 'string')
const shape = typeof args === 'string' ? 'args строкой, а не объектом'
  : A.kind !== 'feature' ? `вид ${A.kind === undefined ? 'не задан' : `«${A.kind}»`}, ждали feature либо bugfix`
  : noPath.length ? `пусто либо не строка: ${noPath.join(', ')}` : ''
if (shape) return done('unverifiable', `вход пробы не разобран: ${shape}`)

phase('Probe')
let p
try {
  p = await agent(`mode: autonomous\nкорень корпуса: ${A.corpus}\nединицы: goal.md - черновик цели (цель, критерий «готово», граница); source.md - источник цели\nконтракт интерфейса путём не подан: ищи рядом с кодом в ${A.cwd}\nдействующие решения: нет\nревизия пробы: 1\nКорпус временный и удаляется после пробы: на диск ничего не пиши - ни метку quality-checks, ни репозиторий снимков; вердикт и список верни выходом.\n${READ_ONLY}`,
    { label: 'probe', phase: 'Probe', schema: PROBE, agentType: PROBE_NODE })
} catch (e) {
  return done('unverifiable', `узел пробы ${PROBE_NODE} не отработал: ${why(e)}`)
}
if (!p) return done('unverifiable', 'узел пробы не вернул выход')
if (p.status === 'blocked') return done('unverifiable', lack(p, 'узел пробы'))
if (p.verdict === 'unverifiable') return done('unverifiable', p.missing || 'узел пробы вынес unverifiable без причины')
const guesses = (p.guesses || []).filter(g => g && typeof g === 'object').map((g, i) => ({ ...g, id: `D${i + 1}` }))
const open = (p.open_items || []).filter(Boolean)
if (!guesses.length && !open.length) {
  if (p.status === 'partial') return done('unverifiable', `проба partial без домыслов: ${p.missing || 'нехватка не названа'}`)
  if (p.verdict === 'failed') return done('unverifiable', 'узел пробы вынес failed без домыслов и открытых пунктов')
  return done('passed', '')
}
if (p.verdict === 'passed') degraded.push('узел пробы вынес passed при непустом списке - судит список')
if (p.status === 'partial') degraded.push(`проба partial: ${p.missing || 'нехватка не названа'}`)
if (!guesses.length) return done('failed', '', { open_items: open })

phase('Sort')
let s = null, err = ''
try {
  s = await agent(`Корень проекта ${A.cwd} - только чтение: ничего не пиши и не меняй. ${READ_ONLY} Черновик цели - ${A.corpus}/goal.md, её источник - ${A.corpus}/source.md.\nПроба нашла в черновике домыслы - решения о наблюдаемом исходе, мере или границе, которых нет ни в черновике, ни в источнике:\n${guesses.map(g => `${g.id}. ${g.where}: ${g.decision}`).join('\n')}\nПо каждому id - запись. derived - код или корпус документации проекта (docs/, ADR, CLAUDE.md, README) уже отвечает: то же решение принято в существующем поведении, контракте или соседнем месте, и новое поведение, решённое иначе, разошлось бы с ним; answer - этот ответ, anchor - файл:строка, где он виден. Иначе question: код молчит либо отвечает только о прежнем поведении, которое источник просит изменить; answer и anchor пусты.`,
    { label: 'sort', phase: 'Sort', schema: SORT, agentType: 'general-purpose' })
} catch (e) { err = why(e) }
if (!s || s.status === 'blocked') {
  degraded.push(`классификатор ${err ? `не отработал (${err})` : !s ? 'не вернул выход' : `blocked: ${s.missing || 'нехватка не названа'}`} - все домыслы вопросами`)
  return done('failed', '', { open_items: open, questions: guesses.map(asQuestion) })
}
if (s.status === 'partial') degraded.push(`классификатор partial: ${s.missing || 'нехватка не названа'}`)
const byId = new Map()
for (const it of s.items || []) {
  if (!it || !guesses.some(g => g.id === it.id)) degraded.push(`классификатор вернул чужой id ${it && it.id}`)
  else if (byId.has(it.id)) degraded.push(`классификатор вернул ${it.id} дважды - взята первая запись`)
  else byId.set(it.id, it)
}
const derived = [], questions = []
for (const g of guesses) {
  const it = byId.get(g.id)
  if (!it) degraded.push(`классификатор не разобрал ${g.id} - вопросом`)
  const at = it && it.class === 'derived' && it.answer && String(it.anchor || '').match(ANCHOR)
  if (at) derived.push({ ...asQuestion(g), answer: it.answer, anchor: at[0] })
  else questions.push(asQuestion(g))
}
return done('failed', '', { open_items: open, derived, questions })
