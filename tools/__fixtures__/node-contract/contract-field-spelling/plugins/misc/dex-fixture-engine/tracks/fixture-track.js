// Фикстурный трек: `run_status` вместо словарного `run-status`, соседние поля написаны верно.
export const meta = {
  name: 'fixture-track',
  description: 'Трек песочницы: схема узла с разъехавшимся написанием одного поля',
  phases: [{ title: 'Fix' }],
}

const STATUS = { type: 'string', enum: ['complete', 'blocked', 'partial'] }
const FIX = { type: 'object', properties: {
  status: STATUS,
  'diff-scope': { type: 'array', items: { type: 'string' }, description: 'пути изменённых файлов + ветка/база' },
  run_status: { type: 'string', description: 'итог прогона build/test/lint узлом' },
  uncovered: { type: 'string', description: 'что осталось непокрытым' },
}, required: ['status', 'diff-scope', 'run_status', 'uncovered'] }

phase('Fix')
const fix = await agent('почини предмет песочницы', { label: 'fix', phase: 'Fix', schema: FIX })
return { fix }
