const STR = { type: 'string' }
const STRS = { type: 'array', items: STR }
const CORPUS = { type: 'string', enum: ['present', 'absent'] }
const CHECK = { type: 'object', properties: {
  status: STATUS, 'corpus-status': CORPUS, 'corpus-basis': STR,
  checks: { type: 'array', items: { type: 'object', properties: { id: STR, verdict: { type: 'string', enum: ['upheld', 'contradicted', 'unverifiable'] }, evidence: STR }, required: ['id', 'verdict', 'evidence'] } },
  missed: { type: 'array', items: { type: 'object', properties: { where: STR, what: STR }, required: ['where', 'what'] } },
  foreign: STRS, secrets: STRS, decisions: STRS, missing: STR,
}, required: ['status', 'corpus-status', 'corpus-basis', 'checks', 'missed', 'foreign', 'secrets', 'decisions', 'missing'] }
const checkGaps = (units, chk) => {
  const ids = new Set(units.map(u => u.id))
  // Строк под одним id бывает несколько: единица подтверждена, только если все они upheld.
  const unheld = units.flatMap(u => {
    const own = chk.checks.filter(c => c.id === u.id)
    return own.length ? own.filter(c => c.verdict !== 'upheld') : [{ id: u.id, verdict: 'без вердикта', evidence: 'строки сверщика с этим id нет' }]
  }).map(c => `${c.id} - ${c.verdict}: ${c.evidence}`)
  // Иначе вердикт под id вне единиц (диапазон у составителя) пропал бы молча.
  const stray = chk.checks.filter(c => !ids.has(c.id)).map(c => c.verdict === 'upheld' ? `${c.id} - upheld` : `${c.id} - ${c.verdict}: ${c.evidence}`)
  return [unheld.length && `единица не подтверждена сверкой: ${unheld.join(' | ')}`,
    stray.length && `вердикт сверщика по id вне единиц: ${stray.join(' | ')}`,
    chk.missed.length && `предмет без единицы корпуса: ${chk.missed.map(m => `${m.where} - ${m.what}`).join(' | ')}`].filter(Boolean)
}
