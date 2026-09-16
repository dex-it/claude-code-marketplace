// Фикстурный трек: имена словарные, но `status` в `required` стоит вторым; вложенная схема находки своего исхода не несёт.
export const meta = {
  name: 'fixture-track',
  description: 'Трек песочницы: схема узла с исходом не на первом месте',
  phases: [{ title: 'Review' }],
}

const STATUS = { type: 'string', enum: ['complete', 'blocked', 'partial'] }
const REVIEW = { type: 'object', properties: {
  'diff-scope': { type: 'array', items: { type: 'string' }, description: 'пути изменённых файлов + ветка/база' },
  status: STATUS,
  findings: { type: 'array', items: { type: 'object', properties: {
    severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] }, anchor: { type: 'string' },
  }, required: ['severity', 'anchor'] } },
  'run-status': { type: 'string', description: 'итог реального прогона build/test' },
}, required: ['diff-scope', 'status', 'findings', 'run-status'] }

phase('Review')
const review = await agent('отревьюй предмет песочницы', { label: 'review', phase: 'Review', schema: REVIEW })
return { review }
