const STR = { type: 'string' }
const STRS = { type: 'array', items: STR }
const CORPUS = { type: 'string', enum: ['present', 'absent'] }
const CHECK = { type: 'object', properties: {
  status: STATUS, 'corpus-status': CORPUS, 'corpus-basis': STR,
  checks: { type: 'array', items: { type: 'object', properties: { id: STR, verdict: { type: 'string', enum: ['upheld', 'contradicted', 'unverifiable'] }, evidence: STR }, required: ['id', 'verdict', 'evidence'] } },
  missed: { type: 'array', items: { type: 'object', properties: { where: STR, what: STR }, required: ['where', 'what'] } },
  foreign: STRS, decisions: STRS, missing: STR,
}, required: ['status', 'corpus-status', 'corpus-basis', 'checks', 'missed', 'foreign', 'decisions', 'missing'] }
const checkGaps = (units, chk) => {
  const byId = new Map(chk.checks.map(c => [c.id, c]))
  const unheld = units.map(u => byId.get(u.id) || { id: u.id, verdict: 'без вердикта', evidence: 'сверщик промолчал' })
    .filter(c => c.verdict !== 'upheld').map(c => `${c.id} - ${c.verdict}: ${c.evidence}`)
  return [unheld.length && `единица не подтверждена сверкой: ${unheld.join(' | ')}`,
    chk.missed.length && `предмет без единицы корпуса: ${chk.missed.map(m => `${m.where} - ${m.what}`).join(' | ')}`].filter(Boolean)
}
