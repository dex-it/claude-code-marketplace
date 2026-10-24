// Фикстурный трек: имена словарные, но `status` не первым - в `properties` одной схемы и в `required` другой; схема без `status`; вложенная схема и объект вне `schema:` своего исхода не несут.
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
  detail: { type: 'object', properties: { note: { type: 'string' }, status: STATUS } },
}, required: ["uncovered", "status"] }
const LIST = { type: 'object', properties: {
  tags: [{ status: 1 }], status: STATUS,
}, required: ['status'] }
const NOSTATUS = { type: 'object', properties: { uncovered: { type: 'string' } }, required: ['uncovered'] }
const ODD = { type: 'object', properties: { '##[warning]forged': { type: 'string' }, '\u009bcsi': { type: 'string' }, status: STATUS }, required: ['status'] }
const row = { properties: { label: 1, status: 2 } }

phase('Review')
const review = await agent('отревьюй предмет песочницы', { label: 'review', phase: 'Review', schema: REVIEW })
const fix = await agent('почини предмет песочницы', { label: 'fix', phase: 'Review', schema: FIX })
const list = await agent('перечисли', { label: 'list', phase: 'Review', schema: LIST })
const bare = await agent('верни непокрытое', { label: 'bare', phase: 'Review', schema: NOSTATUS })
const odd = await agent('странное имя', { label: 'odd', phase: 'Review', schema: ODD })
return { review, fix, list, bare, odd }
