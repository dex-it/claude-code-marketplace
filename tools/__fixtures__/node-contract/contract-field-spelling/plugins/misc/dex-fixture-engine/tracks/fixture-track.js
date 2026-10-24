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

const unfence = (s) => s.replace(/`/g, "'")
const AFTER_REGEX = { RED_RUN: { type: 'string' } }
const hint = `цель: ${String(1).replace(/'/g, '')}`
const AFTER_INTERP = { DIFF_SCOPE: 1 }
const CONTROL = { 'run	status': 1 }
const probe = { p: `${ ({ a: 1 }).a ? '`' : "}" }`, DiffScope: 2 }
const esc = { a: 'it\'s', b: "a\"b", c: 'x\\', RUN_STATUS: 1 }
const nested = { p: `в${ [1].map((n) => `${n}}`) }`, Uncovered2: 0, redRun: 3 }
const tick = { p: `a \` b`, RunStatus: 4 }
const after = `x`
const re = /`/; const AFTER_EQ = { red_run: 1 }
const arr = [/'/]; const AFTER_BRACKET = { run_status: 1 }
const klass = /[/']/; const AFTER_CLASS = { diff_scope: 1 }
function f(x) { return /'/.test(x) } const AFTER_RETURN = { Run_Status: 1 }
if (flag) /`/.test(s); const AFTER_IF = { redRun: 1 }
if (flag) /`/.test(t)
let n = 0; const h = n++ / 2, AFTER_INC = { run_status: 1 }, z = h / 3
const esc2 = { 'run\u005fstatus': 1 }
const DOT = { 'run.status': 1, run__status: 2 }
const a = fix.run_status, b = fix['red_run'], { diff_scope } = fix
const good = fix.status + fix['run-status']

phase('Fix')
const fix = await agent(`почини предмет песочницы, итог положи в поле
{ run_status: ${'нет'} }`, { label: 'fix', phase: 'Fix', schema: FIX })
return { fix }
