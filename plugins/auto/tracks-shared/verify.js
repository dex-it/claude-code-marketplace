const VERIFY = { type: 'object', properties: {
  status: STATUS,
  exit_code: { type: 'integer' }, pass_count: { type: 'integer' }, fail_count: { type: 'integer' },
  failing: { type: 'array', items: { type: 'string' } },
  build_ok: { type: 'boolean' },
  head: { type: 'string', description: 'git log --oneline -3' },
  dirty: { type: 'boolean', description: 'git status --porcelain непустой' },
  ahead: { type: 'integer', description: 'коммитов ветки трека, которых нет ни на одной другой ветке' },
  missing: { type: 'string', description: 'при blocked - почему прогон не выполнен; иначе пусто' },
}, required: ['status', 'exit_code', 'pass_count', 'fail_count', 'failing', 'build_ok', 'head', 'dirty', 'ahead', 'missing'] }
const VERIFY_CMDS = 'git log --oneline -3, git status --porcelain и git rev-list --count HEAD --not --exclude="$(git branch --show-current)" --branches (это ahead)'
// Верификатор, не сумевший прогнать, по exit_code неотличим от красных тестов: без этой ветки трек проедает потолок правок вхолостую.
const noRun = (v) => !v || v.status === 'blocked'
// exit 0 при упавших тестах даёт конвейер в команде раннера; ноль прошедших при команде тестов - прогон, не бывший прогоном тестов.
const isGreen = (v, testCmd) => !!v && v.exit_code === 0 && v.fail_count === 0 && v.build_ok && !v.dirty && !(testCmd && v.pass_count === 0)
const redNote = (v) => `exit=${v.exit_code}, build_ok=${v.build_ok}, прошло тестов: ${v.pass_count}, падают: ${v.failing.join('; ') || 'нет'}, dirty=${v.dirty}`
