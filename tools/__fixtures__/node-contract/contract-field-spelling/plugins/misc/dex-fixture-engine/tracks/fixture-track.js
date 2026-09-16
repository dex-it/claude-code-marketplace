// Фикстурный трек: `run_status`, ключ в кавычках `'red_run'`, второй ключ в строке `runStatus`, `required` в двойных кавычках - вместо словарных имён; шаблонная строка промпта ключом не считается.
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
  'red_run': { type: 'string', description: 'чем показан красным тест' },
}, required: ['status', 'diff-scope', 'run_status', 'uncovered'] }

const VERIFY = { type: 'object', properties: {
  status: STATUS, commit: { type: 'string' }, runStatus: { type: 'string' },
}, required: ["status", "Diff_Scope"] }

// { red_run: устаревшее имя в комментарии ключом не считается }
const pick = (flag, Red_Run) => flag ? Red_Run : 'нет'
/* { run_status: и в блочном комментарии } */

phase('Fix')
const fix = await agent(`почини предмет песочницы, итог положи в поле
{ run_status: ${'нет'} }`, { label: 'fix', phase: 'Fix', schema: FIX })
return { fix }
