const VERIFY = { type: 'object', properties: {
  status: STATUS,
  exit_code: { type: 'integer' }, pass_count: { type: 'integer' }, fail_count: { type: 'integer' },
  failing: { type: 'array', items: { type: 'string' } },
  flaky: { type: 'array', items: { type: 'string' }, description: 'упали в первом прогоне и прошли в повторе' },
  build_ok: { type: 'boolean' },
  head: { type: 'string', description: 'git log --oneline -3' },
  head_sha: { type: 'string', description: 'git rev-parse HEAD' },
  dirty: { type: 'boolean', description: 'git status --porcelain непустой' },
  ahead: { type: 'integer', description: 'коммитов ветки трека, которых нет ни на одной другой ветке' },
  delta: { type: ['array', 'null'], items: { type: 'string' }, description: 'места правки от delta_from до рабочего дерева: file:from-to, file:line, file; поля нет в JSON - null' },
  missing: { type: 'string', description: 'при blocked - почему прогон не выполнен; иначе пусто' },
}, required: ['status', 'exit_code', 'pass_count', 'fail_count', 'failing', 'build_ok', 'head', 'head_sha', 'dirty', 'ahead', 'delta', 'missing'] }
const AHEAD_CMD = 'git rev-list --count HEAD --not --exclude="$(git branch --show-current)" --branches'
const VERIFY_CMDS = `git log --oneline -3, git rev-parse HEAD (это head_sha), git status --porcelain и ${AHEAD_CMD} (это ahead)`
// Команды едут скрипту hex-строкой: кавычки и $ в команде проекта шелл модели не портит.
const hexOf = (s) => encodeURIComponent(s).replace(/%([0-9A-F]{2})|[^%]/g, (m, h) => h ? h.toLowerCase() : m.charCodeAt(0).toString(16).padStart(2, '0'))
// Команды ведёт кодер: подготовка снимает их до правки, и раннер, заведённый правкой, иначе не гонялся бы никогда.
const withCommands = (t, f) => {
  const c = (f && f.commands) || {}, build = String(c.build_cmd || '').trim(), test = String(c.test_cmd || '').trim()
  if (!t || (!build && !test)) return t
  return { ...t, ...(build ? { build_cmd: build } : {}), ...(test && test !== t.test_cmd ? { test_cmd: test, report_cmd: String(c.report_cmd || '').trim() } : {}) }
}
// test_cmd строки - действующая команда тестов, та, что гоняет verifySpec: report_cmd, иначе test_cmd. Одна test_cmd при заведённом report_cmd
// показала бы в «стало» не тот прогон, который верификация гоняла.
const cmdsOf = (t) => ({ build_cmd: String((t && t.build_cmd) || '').trim(), test_cmd: String((t && t.report_cmd) || '').trim() || String((t && t.test_cmd) || '').trim() })
// Созданная кодером на пустом месте команда строки не даёт: судить замену не с чем.
const swapText = (was, t) => {
  const now = cmdsOf(t), s = was ? ['build_cmd', 'test_cmd'].filter(k => was[k] && now[k] !== was[k]).map(k => `${k}: было «${was[k]}», стало «${now[k]}»`) : []
  return s.length ? `\nКодер заменил команды прогона: ${s.join('; ')}. Замена, сужающая охват прогона без причины в плане кодера, - находка.` : ''
}
const verifySpec = (t, known, extra) => ({ build: t.build_cmd || '', test: t.report_cmd || t.test_cmd || '', known: known || [], ...extra })
const verifyRun = (scripts, spec) => `Выполни командой Bash с timeout 600000: python3 '${scripts}/verify.py' ${hexOf(JSON.stringify(spec))}
stdout - JSON. status running - повтори python3 '${scripts}/verify.py' --wait <его out> тем же timeout, пока status не станет другим. Поля схемы перенеси из итогового JSON как есть; counts null - pass_count, fail_count и failing выведи из test_tail. Команда не вернула JSON - status blocked, в missing её вывод.`
// Верификатор, не сумевший прогнать, по exit_code неотличим от красных тестов: без этой ветки трек проедает потолок правок вхолостую.
const noRun = (v) => !v || v.status === 'blocked'
const freshFails = (v, known) => ((v && v.failing) || []).filter(f => !(known || []).includes(f))
// Падение базы правке не вменяется, но безымянное падение (exit не 0 при пустом failing) унаследованным не считается.
const isGreen = (v, testCmd, known) => !!v && v.build_ok && !v.dirty && !(testCmd && !(v.pass_count > 0)) && !freshFails(v, known).length
  && ((v.exit_code === 0 && v.fail_count === 0) || (v.failing.length > 0 && v.fail_count <= v.failing.length))
const inheritedFails = (v, known) => ((v && v.failing) || []).filter(f => (known || []).includes(f))
const redNote = (v, known) => `exit=${v.exit_code}, build_ok=${v.build_ok}, прошло тестов: ${v.pass_count}, новые падения: ${freshFails(v, known).join('; ') || 'нет'}${inheritedFails(v, known).length ? `, унаследованы от базы: ${inheritedFails(v, known).join('; ')}` : ''}, dirty=${v.dirty}`
const NO_SCRIPTS = 'каталог скриптов не подан (args.scripts): верификатор гоняет команды сам - без отчёта раннера и повтора нестабильных'
// Полный набор кодер гонял сам и следом его же гонял верификатор: на больших наборах это удваивало каждую попытку.
const COVER_ONLY = 'Гоняй тесты задетого правкой, полный набор не гоняй.'
