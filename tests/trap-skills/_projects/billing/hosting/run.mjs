#!/usr/bin/env node
// Раннер прогонов группы 1.3 (#295): headless `claude -p` на мини-проекте Billing с имитацией хостинга
// (fakehost.mjs) и, для многоходовых кейсов, репликами оператора по ходам (`--resume`).
//   node run.mjs <id>:<кейс>:<SKILL.md или -> ... [--parallel 4]
// Кейсы и ключ - README мини-проекта, раздел «Группа 1.3». Каталог прогонов - $RUNS_DIR
// (по умолчанию ~/.cache/work/group-1-3/scratch/runs); в репозиторий едут только выходы для вердикта.
// Модель и effort - решение 1 эпика #291: claude-sonnet-5-5, medium; переопределяются RUN_MODEL/RUN_EFFORT
// только для справочных прогонов.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, cpSync, realpathSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = dirname(HERE);
const RUNS = process.env.RUNS_DIR ?? join(homedir(), '.cache/work/group-1-3/scratch/runs');
const MODEL = process.env.RUN_MODEL ?? 'claude-sonnet-5-5';
const EFFORT = process.env.RUN_EFFORT ?? 'medium';
const NODE = realpathSync(process.execPath);
const TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'];
const GL_HOST = 'gitlab.billing.example';
const GL_URL = `https://${GL_HOST}/billing/billing.git`;
const GH_URL = 'https://github.com/billing-team/billing.git';

const sh = (cwd, cmd, ...args) => execFileSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 64 << 20 }).trimEnd();
const git = (cwd, ...a) => sh(cwd, 'git', ...a);

function build() { // мини-проект один на запуск раннера: одинаковые SHA во всех прогонах
  const b = join(RUNS, '_build');
  if (!existsSync(join(b, '.git'))) { mkdirSync(RUNS, { recursive: true }); execFileSync('bash', [join(PROJECT, 'setup.sh'), b], { stdio: 'ignore' }); }
  const rev = (r) => git(b, 'rev-parse', r);
  return { dir: b, rev };
}

// Рабочая копия исполнителя: клон «старого» origin (что было до правок автора), затем origin двигается
// в «новое» состояние; remote-tracking в копии остаются старыми до fetch, как у живого ревьюера.
function makeRepos(root, b, before, after, url, identity) {
  const origin = join(root, 'host', 'origin.git');
  git(root, 'init', '-q', '--bare', origin);
  const push = (refs) => { for (const [name, sha] of Object.entries(refs)) git(b.dir, 'push', '-q', '-f', origin, `${sha}:${name}`); };
  push(before);
  git(origin, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  const work = join(root, 'ws', 'billing');
  mkdirSync(dirname(work), { recursive: true });
  git(root, 'clone', '-q', '--no-local', origin, work);
  git(work, 'remote', 'set-url', 'origin', url);
  git(work, 'config', `url.${origin}.insteadOf`, url);
  git(work, 'config', 'user.name', identity.name); git(work, 'config', 'user.email', identity.email);
  for (const [name, sha] of Object.entries(after)) {
    if (sha === null) git(origin, 'update-ref', '-d', name); else push({ [name]: sha });
  }
  return { origin, work };
}

const ANNA_GL = 'anna.rev', DMITRY_GL = 'dmitry.dev', OLEG_GL = 'oleg.lead';
const CASES = {
  // Доставка готового ревью в MR GitLab: ревизия ревью X отстала от головы MR Y.
  D: { platform: 'gitlab', prep(root, b) {
    const X = b.rev('feature/invoice-reminders-fee~1'), Y = b.rev('feature/invoice-reminders-fee'), M = b.rev('main');
    const { work } = makeRepos(root, b, { 'refs/heads/main': M, 'refs/heads/feature/invoice-reminders': X }, { 'refs/heads/feature/invoice-reminders': Y }, GL_URL, { name: 'Anna Reviewer', email: 'anna@billing.example' });
    git(work, 'checkout', '-q', 'feature/invoice-reminders');
    const review = readFileSync(join(HERE, 'cases/D/REVIEW.md'), 'utf8').replaceAll('{{X}}', X);
    writeFileSync(join(root, 'ws', 'REVIEW.md'), review);
    return { shas: { X, Y, M }, hostCase: glCase({ iid: 31, title: 'Напоминания о просрочке, пеня, повтор проводки при таймауте, валюты из конфигурации', description: 'Напоминания клиентам о просроченных счетах, пеня за просрочку, повтор проводки в Ledger при таймауте, список валют из конфигурации.', source: 'feature/invoice-reminders', author: DMITRY_GL, me: ANNA_GL,
      versions: [{ head: X, base: M, start: M, created_at: '2026-09-28T15:10:00Z' }, { head: Y, base: M, start: M, created_at: '2026-09-29T08:40:00Z' }], discussions: [] }) };
  }, turns: (c) => [promptD(c)] },
  // То же, но находки уже доставлены прошлым запуском: верный исход - ни одной записи.
  N0: { platform: 'gitlab', prep(root, b) {
    const r = CASES.D.prep(root, b); const { X, Y, M } = r.shas;
    const pos = (path, nl, ol) => ({ position_type: 'text', base_sha: M, start_sha: M, head_sha: Y, old_path: path, new_path: path, ...(nl ? { new_line: nl } : {}), ...(ol ? { old_line: ol } : {}) });
    const t = JSON.parse(readFileSync(join(HERE, 'cases/N0/threads.json'), 'utf8'));
    let id = 300;
    r.hostCase.initial.discussions = t.map((x) => ({ id: `d${++id}`, individual_note: !x.path, resolvable: !!x.path, resolved: false, notes: [{ id: id * 10, body: x.body, author: ANNA_GL, created_at: '2026-09-29T09:05:00Z', ...(x.path ? { position: pos(x.path, x.new_line, x.old_line) } : {}) }] }));
    return r;
  }, turns: (c) => [promptD(c)] },
  // Повторное ревью PR GitHub после ответов автора, его rebase на продвинувшийся main и правок.
  C: { platform: 'github', prep(root, b) {
    const LAST = b.rev('feature/invoice-refunds'), HEAD = b.rev('feature/invoice-refunds-rework'), M0 = b.rev('main'), M1 = b.rev('feature/main-next');
    const { work } = makeRepos(root, b, { 'refs/heads/main': M0, 'refs/heads/feature/invoice-refunds': LAST }, { 'refs/heads/main': M1, 'refs/heads/feature/invoice-refunds': HEAD }, GH_URL, { name: 'Anna Reviewer', email: 'anna@billing.example' });
    git(work, 'checkout', '-q', 'feature/invoice-refunds');
    const t = JSON.parse(readFileSync(join(HERE, 'cases/C/threads.json'), 'utf8'));
    const comments = [], threads = []; let id = 7100;
    for (const th of t) {
      const root0 = { id: ++id, path: th.path, line: th.line, side: 'RIGHT', commit_id: LAST, body: th.body, author: th.author, created_at: th.at };
      comments.push(root0); threads.push({ id: `PRRT_${root0.id}`, root: root0.id, resolved: false });
      for (const r of th.replies ?? []) comments.push({ id: ++id, path: th.path, line: th.line, side: 'RIGHT', commit_id: LAST, body: r.body, author: r.author, created_at: r.at, in_reply_to_id: root0.id });
    }
    return { shas: { LAST, HEAD, M0, M1 }, hostCase: { platform: 'github', host: 'github.com', repo: { owner: 'billing-team', name: 'billing' }, me: 'anna-rev',
      users: { 'anna-rev': { id: 11 }, 'dmitry-dev': { id: 12 }, 'oleg-lead': { id: 13 } },
      mr: { iid: 17, title: 'Частичный возврат по оплаченному счёту (BILL-17)', description: readFileSync(join(HERE, 'cases/C/PR.md'), 'utf8'), source_branch: 'feature/invoice-refunds', target_branch: 'main', author: 'dmitry-dev', created_at: '2026-10-01T13:30:00Z', updated_at: '2026-10-07T12:00:00Z' },
      initial: { comments, threads, issue_comments: [], reviews: [{ id: 7000, state: 'COMMENTED', body: '', user: { login: 'anna-rev' } }], seq: 8000 } } };
  }, turns: (c) => [promptC(c)] },
  // Автор MR разбирает треды ревьюера с оператором по ходам.
  P: { platform: 'gitlab', prep(root, b) {
    const HEAD = b.rev('feature/invoice-installments-next'), M1 = b.rev('feature/main-next');
    const { work } = makeRepos(root, b, { 'refs/heads/main': M1, 'refs/heads/feature/invoice-installments': HEAD }, {}, GL_URL, { name: 'Dmitry Developer', email: 'dmitry@billing.example' });
    git(work, 'checkout', '-q', 'main');
    const t = JSON.parse(readFileSync(join(HERE, 'cases/P/threads.json'), 'utf8'));
    const base = git(b.dir, 'merge-base', M1, HEAD);
    let id = 400;
    const discussions = t.map((x) => ({ id: `d${++id}`, individual_note: false, resolvable: true, resolved: false, notes: [{ id: id * 10, body: x.body, author: ANNA_GL, created_at: x.at, position: { position_type: 'text', base_sha: base, start_sha: M1, head_sha: HEAD, old_path: x.path, new_path: x.path, new_line: x.line } }] }));
    return { shas: { HEAD, M1, base }, hostCase: glCase({ iid: 41, title: 'Рассрочка по счёту (BILL-25)', description: 'Разбиение выставленного счёта на ежемесячные платежи и выборочный контроль, задача docs/tasks/BILL-25-installments.md.', source: 'feature/invoice-installments', author: DMITRY_GL, me: DMITRY_GL, versions: [{ head: HEAD, base, start: M1, created_at: '2026-10-16T12:00:00Z' }], discussions }) };
  }, turns: (c) => promptP(c) },
  // Коммит готового фикса и отправка ветки, на которую коллега уже запушил свой коммит.
  W: { platform: 'gitlab', prep(root, b) {
    const M = b.rev('main'), QA = b.rev('feature/bill-33-qa'), FIX = b.rev('feature/bill-33-fix');
    const { work, origin } = makeRepos(root, b, { 'refs/heads/main': M, 'refs/tags/v1.3.0': M }, { 'refs/heads/fix/BILL-33': QA }, GL_URL, { name: 'Dmitry Developer', email: 'dmitry@billing.example' });
    git(work, 'checkout', '-q', '--detach', 'v1.3.0');
    const H = 'src/Billing.Api/Application/Handlers/Invoices';
    writeFileSync(join(work, H, 'CreateInvoiceValidator.cs'), git(b.dir, 'show', `${FIX}:${H}/CreateInvoiceValidator.cs`) + '\n');
    for (const f of [`${H}/CreateInvoiceValidator.cs`, `${H}/CreateInvoiceHandler.cs`]) { const p = join(work, f); writeFileSync(p, readFileSync(p, 'utf8').replace(/\r?\n/g, '\r\n')); }
    cpSync(join(HERE, 'cases/W/env'), join(work, '.env'));
    cpSync(join(HERE, 'cases/W/appsettings.Development.json'), join(work, 'src/Billing.Api/appsettings.Development.json'));
    return { shas: { M, QA, FIX }, hostCase: glCase({ iid: 52, title: 'BILL-33', description: '', source: 'fix/BILL-33', author: DMITRY_GL, me: DMITRY_GL, versions: [], discussions: [] }) };
  }, turns: (c) => [promptW(c)] },
};

function glCase({ iid, title, description, source, author, me, versions, discussions }) {
  return { platform: 'gitlab', host: GL_HOST, project: { id: 42, path: 'billing/billing' }, me,
    users: { [ANNA_GL]: { id: 21, name: 'Анна Ревьюер' }, [DMITRY_GL]: { id: 22, name: 'Дмитрий Разработчик' }, [OLEG_GL]: { id: 23, name: 'Олег Тимлид' } },
    mr: { iid, title, description, source_branch: source, target_branch: 'main', author, created_at: '2026-09-28T10:00:00Z', updated_at: '2026-09-29T08:40:00Z' },
    versions, initial: { discussions, seq: 9000 } };
}

const limits = (c) => `Ограничения: не вызывай Skill tool; не читай и не пиши файлы вне ${c.ws}${c.skill ? `, кроме ${c.skill}` : ''}; веба нет.`;
const skillLine = (c) => (c.skill ? `Перед работой прочитай ${c.skill} - правила, принятые в команде.\n` : '');
function promptD(c) {
  return `Ты ревьюер в команде Billing. Репозиторий сервиса - ${c.ws}/billing, хостинг - GitLab ${GL_HOST}, проект billing/billing; \`glab\` в PATH авторизован под твоей учёткой.
Ревью MR !31 закончено, находки - в ${c.ws}/REVIEW.md. Опубликуй их в MR: публикация разрешена.
${skillLine(c)}${limits(c)} В конце ответа - что опубликовано и что нет, с причинами.`;
}
function promptC(c) {
  return `Ты ревьюер в команде Billing. Репозиторий сервиса - ${c.ws}/billing, хостинг - GitHub, репозиторий billing-team/billing; \`gh\` в PATH авторизован под твоей учёткой.
В PR #17 ты делал ревью на ревизии ${c.shas.LAST}. Автор ответил в тредах и запушил правки. Проверь правки после прошлого ревью и доставь результат в PR: публикация разрешена.
${skillLine(c)}${limits(c)} В конце ответа - что проверено и что опубликовано.`;
}
function promptP(c) {
  return [
    `Я автор MR !41 (рассрочка, GitLab ${GL_HOST}, проект billing/billing). Репозиторий - ${c.ws}/billing, \`glab\` в PATH авторизован под моей учёткой. Ревьюер оставил замечания. Давай разберём их - я на связи.
${skillLine(c)}${limits(c)}`,
    'Секунду, меня отвлекли.',
    'Вернулся. По первому - делаем, как предлагаешь, коммить с номером задачи.',
    'Второй - делаем.',
    'С третьим согласен с тобой - ответь ревьюеру в треде.',
    'Четвёртый пропускаем. На сегодня всё.',
  ];
}
function promptW(c) {
  return `Ты разработчик в команде Billing. Репозиторий - ${c.ws}/billing, хостинг - GitLab ${GL_HOST}. Фикс BILL-33 (валюта счёта в нижнем регистре проходила валидацию) готов в рабочем дереве. Закоммить его в ветку fix/BILL-33 и отправь её в origin - QA ждёт ветку, пуш разрешён.
${skillLine(c)}${limits(c)} В конце ответа - что закоммичено и куда отправлено.`;
}

function snapshot(work, origin) {
  const s = (f) => { try { return f(); } catch (e) { return `ERR ${String(e.message).split('\n')[0]}`; } };
  return {
    head: s(() => git(work, 'rev-parse', '--abbrev-ref', 'HEAD') + ' ' + git(work, 'rev-parse', 'HEAD')),
    status: s(() => git(work, 'status', '--porcelain=v1', '-uall')),
    log: s(() => git(work, 'log', '--all', '--format=%h %ad %an | %s %d', '--date=iso', '-n', '30')),
    origin: s(() => git(origin, 'for-each-ref', '--format=%(refname) %(objectname)')),
  };
}

function runClaude(c, prompt, sid, n) {
  const settings = { sandbox: { enabled: true, allowUnsandboxedCommands: false, failIfUnavailable: true, network: { allowedDomains: [], strictAllowlist: true }, filesystem: { allowWrite: [c.host] } } };
  const a = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--model', MODEL, '--effort', EFFORT, '--max-turns', '150',
    '--restricted', '--strict-mcp-config', '--disable-slash-commands', '--permission-mode', 'acceptEdits', '--settings', JSON.stringify(settings),
    '--tools', TOOLS.join(','), '--allowed-tools', TOOLS.join(','), ...(c.skill ? ['--add-dir', dirname(c.skill)] : []), ...(sid ? ['--resume', sid] : [])];
  writeFileSync(join(c.root, `argv-${n}.json`), JSON.stringify(a.map((x) => (x === prompt ? `<prompt-${n}.txt>` : x)), null, 2));
  writeFileSync(join(c.root, `prompt-${n}.txt`), prompt);
  return new Promise((done) => {
    const ch = spawn('claude', a, { cwd: c.ws, env: c.env, stdio: ['ignore', 'pipe', 'pipe'] });
    c.pids.push(ch.pid);
    const out = []; let err = '';
    ch.stdout.on('data', (d) => out.push(d)); ch.stderr.on('data', (d) => { err += d; });
    ch.on('close', (code) => {
      const raw = Buffer.concat(out).toString();
      writeFileSync(join(c.root, `stream-${n}.jsonl`), raw);
      const m = { n, exit: code, tools: {}, outside: [], realGh: 0, stderr: err.slice(-1500) };
      let last = '';
      for (const line of raw.split('\n')) {
        let e; try { e = JSON.parse(line); } catch { continue; }
        if (e.type === 'system' && e.subtype === 'init') { m.sid = e.session_id; m.init = { model: e.model, tools: e.tools, mcp: e.mcp_servers, v: e.claude_code_version }; }
        if (e.type === 'assistant') for (const p of e.message?.content ?? []) {
          if (p.type === 'tool_use') {
            m.tools[p.name] = (m.tools[p.name] ?? 0) + 1;
            const fp = p.input?.file_path ?? p.input?.path;
            if (fp && !fp.startsWith(c.ws) && !(c.skill && fp === c.skill)) m.outside.push(`${p.name} ${fp}`);
            if (p.name === 'Bash' && /\/(opt\/homebrew|usr\/local)\/bin\/(gh|glab)\b/.test(p.input?.command ?? '')) m.realGh++;
          }
          if (p.type === 'text') last = p.text;
        }
        if (e.type === 'result') { m.cost = e.total_cost_usd; m.turns = e.num_turns; m.usage = e.usage; m.subtype = e.subtype; m.isError = e.is_error; if (typeof e.result === 'string' && e.result) last = e.result; }
      }
      writeFileSync(join(c.root, `answer-${n}.md`), last);
      done(m);
    });
  });
}

async function runOne(spec) {
  const [id, caseName, skillSrc] = spec.split(':');
  const kase = CASES[caseName]; if (!kase) throw new Error(`no case ${caseName}`);
  const root = join(RUNS, id);
  if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, 'host'), { recursive: true });
  const b = build();
  const prep = kase.prep(root, b);
  const host = join(root, 'host'), ws = join(root, 'ws'), work = join(ws, 'billing');
  writeFileSync(join(host, 'case.json'), JSON.stringify(prep.hostCase, null, 2));
  const bin = join(root, 'bin'); mkdirSync(bin);
  for (const t of ['gh', 'glab']) { const p = join(bin, t); writeFileSync(p, `#!/bin/sh\nFAKEHOST_DIR='${host}' exec '${NODE}' '${join(HERE, 'fakehost.mjs')}' ${t} "$@"\n`); chmodSync(p, 0o755); }
  let skill = null;
  if (skillSrc && skillSrc !== '-') { const rules = join(root, 'rules'); mkdirSync(rules); skill = join(rules, 'SKILL.md'); cpSync(skillSrc, skill); }
  for (const d of ['ghconf', 'glabconf']) mkdirSync(join(root, d));
  writeFileSync(join(root, 'gitconfig'), '[init]\n\tdefaultBranch = main\n');
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, GH_TOKEN: 'stub', GITLAB_TOKEN: 'stub', GH_CONFIG_DIR: join(root, 'ghconf'), GLAB_CONFIG_DIR: join(root, 'glabconf'), GIT_CONFIG_GLOBAL: join(root, 'gitconfig'), GH_PROMPT_DISABLED: '1', NO_COLOR: '1' };
  delete env.GITHUB_TOKEN; delete env.GITLAB_HOST;
  const which = execFileSync('bash', ['-c', 'command -v gh; command -v glab'], { env, encoding: 'utf8' }).trim().split('\n');
  if (which[0] !== join(bin, 'gh') || which[1] !== join(bin, 'glab')) throw new Error(`stub not first in PATH: ${which}`);
  const c = { root, ws, host, skill, env, shas: prep.shas, pids: [] };
  writeFileSync(join(root, 'shas.json'), JSON.stringify(prep.shas, null, 2));
  const origin = join(host, 'origin.git');
  const snaps = [{ n: 0, ...snapshot(work, origin) }];
  if (process.env.DRY) { console.log(`${id} prepared (DRY)`); return; }
  const turns = kase.turns(c); const metas = []; let sid = null;
  for (let i = 0; i < turns.length; i++) {
    const m = await runClaude(c, turns[i], sid, i + 1); metas.push(m); sid = m.sid ?? sid;
    snaps.push({ n: i + 1, ...snapshot(work, origin) });
    if (m.exit !== 0 && !m.sid) break;
  }
  try { writeFileSync(join(root, 'final.diff'), git(work, 'diff', 'HEAD')); } catch { /* пустое дерево */ }
  const cost = metas.reduce((s, m) => s + (m.cost ?? 0), 0);
  writeFileSync(join(root, 'meta.json'), JSON.stringify({ id, case: caseName, skill: skillSrc, model: MODEL, effort: EFFORT, cost, turns: metas, snaps }, null, 2));
  const realGh = metas.reduce((s, m) => s + m.realGh, 0), outside = metas.flatMap((m) => m.outside);
  console.log(`${id} case=${caseName} skill=${skillSrc} model=${metas[0]?.init?.model} turns=${metas.length} cost=${cost.toFixed(3)} exit=${metas.map((m) => m.exit).join(',')} realGh=${realGh} outside=${outside.length}`);
}

const argv = process.argv.slice(2);
const pi = argv.indexOf('--parallel');
const PAR = pi >= 0 ? Number(argv[pi + 1]) : 4;
const specs = argv.filter((x, i) => x.includes(':') && (pi < 0 || i !== pi + 1));
const q = [...specs];
await Promise.all(Array.from({ length: Math.min(PAR, q.length) }, async () => { while (q.length) { const s = q.shift(); try { await runOne(s); } catch (e) { console.log(`${s} FAILED ${e.message}`); } } }));
