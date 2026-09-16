// Фикстурный трек: имена словарные, но `status` не первым - в `properties` одной схемы и в `required` другой; вложенная схема находки своего исхода не несёт.
export const meta = {
  name: 'fixture-track',
  description: 'Трек песочницы: схемы узлов с исходом не на первом месте',
  phases: [{ title: 'Review' }],
}

const STATUS = { type: 'string', enum: ['complete', 'blocked', 'partial'] }
const REVIEW = { type: 'object', properties: {
  'diff-scope': { type: 'array', items: { type: 'string' }, description: 'пути изменённых файлов + ветка/база' },
  status: STATUS,
  findings: { type: 'array', items: { type: 'object', properties: {
    severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] }, anchor: { type: 'string' },
  }, required: ['severity', 'anchor'] } },
}, required: ['status', 'diff-scope', 'findings'] }
const FIX = { type: 'object', properties: {
  status: STATUS, uncovered: { type: 'string' },
}, required: ["uncovered", "status"] }

phase('Review')
const review = await agent('отревьюй предмет песочницы', { label: 'review', phase: 'Review', schema: REVIEW })
const fix = await agent('почини предмет песочницы', { label: 'fix', phase: 'Review', schema: FIX })
return { review, fix }
