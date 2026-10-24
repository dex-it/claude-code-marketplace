#!/usr/bin/env node
// Раннер группы 4.7 (#308): кейсы на мини-проекте ordering, промпты дословно. Исполнитель - claude-sonnet-5-5, effort medium,
// песочница без сети; скилл подаётся копией SKILL.md путём (--add-dir), Skill tool не вызывается.
//   G47_WORK=<каталог вне репозитория> node run.mjs <id>:<кейс>:<SKILL.md|-> ... [--parallel N]
// кейсы: OBSW OBSR OBS0 MC1 MC2 MC0 ET1 ET0 DA1 DA0 TA1 TA0 (K6-K8 - _projects/shipping/run.mjs)
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, copyFileSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORK = process.env.G47_WORK; if (!WORK) { console.error('G47_WORK не задан'); process.exit(2); }
const MODEL = 'claude-sonnet-5-5', EFFORT = 'medium';
const NODEDIR = dirname(realpathSync(process.execPath));
const PATH = `${NODEDIR}:/usr/bin:/bin:/usr/sbin:/sbin`; // без homebrew: kubectl и docker недоступны
const out = { review: 'REVIEW.md', session: 'SESSION.md', audit: 'AUDIT.md' };
const REVIEW = (w, b, mr) => `Ты ревьюер команды Ordering. Git-репозиторий - ${w}, ветка ${b}; описание MR - ${mr}, дифф - \`git diff main...HEAD\`. Запиши находки в ${w}/REVIEW.md, по строке на находку: файл и место - что не так и чем кончится - severity (blocker/major/minor). Без вступлений и резюме. Код не правь, коммитить не нужно.`;
const CASES = {
  OBSW: { branch: 'obs-write', out: null, p: (w, b) => `Ты разработчик команды Ordering. Git-репозиторий - ${w}, ветка ${b}; задача - docs/tasks/OB-1.md. Выполни её в рабочем дереве. Не коммить.` },
  OBSR: { branch: 'obs-review', out: 'REVIEW.md', p: (w, b) => REVIEW(w, b, 'docs/mr/MR-41.md') },
  OBS0: { branch: 'obs-clean', out: 'REVIEW.md', p: (w, b) => REVIEW(w, b, 'docs/mr/MR-42.md') },
  MC1: { branch: 'mc-merge', out: null, p: (w, b) => `Ты разработчик команды Ordering. Git-репозиторий - ${w}, ветка ${b} отстала от main. Подтяни в неё актуальный main (merge) и разреши конфликты. Проект - \`tools/ordercli\`, тесты - \`npm test\` в нём. Результат - локально разрешённая ветка; remote нет, push не нужен.` },
  MC2: { branch: 'mc-rebase', out: null, p: (w, b) => `Ты разработчик команды Ordering. Git-репозиторий - ${w}, ветка ${b} отстала от main. Перебазируй её на актуальный main (rebase) и разреши конфликты. Проект - \`tools/ordercli\`, тесты - \`npm test\` в нём. Результат - локально перебазированная ветка; remote нет, push не нужен.` },
  MC0: { branch: 'mc-clean', out: null, p: (w, b) => `Ты разработчик команды Ordering. Git-репозиторий - ${w}, ветка ${b} отстала от main. Подтяни в неё актуальный main (merge). Проект - \`tools/ordercli\`, тесты - \`npm test\` в нём. Результат - локально слитая ветка; remote нет, push не нужен.` },
  ET1: { branch: 'et-bugs', out: 'SESSION.md', p: (w, b) => `Ты тестировщик команды Ordering. Git-репозиторий - ${w}, ветка ${b}: новая фича - CLI заказов (\`tools/ordercli/bin/orders.js\`, спецификация docs/ORDERS-SPEC.md). Найди дефекты фичи, запуская её (\`ORDERS_FILE\` - файл внутри ${w}/scratch). Результат - ${w}/SESSION.md: что и как исследовал и найденные дефекты с шагами воспроизведения. Код не правь.` },
  ET0: { branch: 'et-clean', out: 'SESSION.md', p: (w, b) => `Ты тестировщик команды Ordering. Git-репозиторий - ${w}, ветка ${b}: новая фича - CLI заказов (\`tools/ordercli/bin/orders.js\`, спецификация docs/ORDERS-SPEC.md). Найди дефекты фичи, запуская её (\`ORDERS_FILE\` - файл внутри ${w}/scratch). Результат - ${w}/SESSION.md: что и как исследовал и найденные дефекты с шагами воспроизведения. Код не правь.` },
  DA1: { branch: 'da-audit', out: 'AUDIT.md', p: (w, b) => `Ты инженер команды Ordering. Git-репозиторий - ${w}, ветка ${b}; компонент - \`services/orders-api/Outbox\`. Разбери его критически: что сломается под нагрузкой и при отказах. Результат - ${w}/AUDIT.md: по строке на находку: файл и место - что не так и чем кончится - Critical/Medium/Minor. Код не правь, сборки нет.` },
  DA0: { branch: 'da-clean', out: 'AUDIT.md', p: (w, b) => `Ты инженер команды Ordering. Git-репозиторий - ${w}, ветка ${b}; компонент - \`services/orders-api/Outbox\`. Разбери его критически: что сломается под нагрузкой и при отказах. Результат - ${w}/AUDIT.md: по строке на находку: файл и место - что не так и чем кончится - Critical/Medium/Minor. Код не правь, сборки нет.` },
  TA1: { branch: 'ta-audit', out: 'AUDIT.md', p: (w, b) => `Ты технический лид команды Ordering. Git-репозиторий - ${w}, ветка ${b}; команда предложила RFC (\`docs/rfc/\`), контекст - docs/services.md. Оцени предложение: стоит ли так делать. Результат - ${w}/AUDIT.md. Код и RFC не правь.` },
  TA0: { branch: 'ta-clean', out: 'AUDIT.md', p: (w, b) => `Ты технический лид команды Ordering. Git-репозиторий - ${w}, ветка ${b}; команда предложила RFC (\`docs/rfc/\`), контекст - docs/services.md. Оцени предложение: стоит ли так делать. Результат - ${w}/AUDIT.md. Код и RFC не правь.` },
};

async function runOne(spec) {
  const [id, cs, skill] = spec.split(':'); const c = CASES[cs]; if (!c) throw new Error(`нет кейса ${cs}`);
  const root = join(WORK, 'runs', id); rmSync(root, { recursive: true, force: true }); mkdirSync(root, { recursive: true });
  for (let d = root; d !== '/'; d = dirname(d)) if (existsSync(join(d, 'CLAUDE.md'))) throw new Error(`CLAUDE.md на пути: ${d}`);
  const w = join(root, 'ordering'); mkdirSync(join(w, '..'), { recursive: true });
  execFileSync('bash', [join(HERE, 'setup.sh'), w, `feature/${c.branch}`], { stdio: 'ignore' });
  mkdirSync(join(w, 'scratch'));
  const b = `feature/${c.branch}`; let prompt = c.p(w, b); let add = [];
  if (skill && skill !== '-') { const r = join(root, 'rules'); mkdirSync(r); copyFileSync(skill, join(r, 'SKILL.md'));
    prompt += `\nПеред работой прочитай ${join(r, 'SKILL.md')} - правила, принятые в команде.`; add = ['--add-dir', r]; }
  prompt += `\nОграничения: не вызывай Skill tool; не читай и не пиши файлы вне ${root}; веба нет.`;
  writeFileSync(join(root, 'prompt.txt'), prompt);
  const settings = { sandbox: { enabled: true, allowUnsandboxedCommands: false, failIfUnavailable: true, network: { allowedDomains: [], strictAllowlist: true }, filesystem: { allowWrite: [root] } } };
  const gc = join(root, 'gitconfig'); writeFileSync(gc, '[user]\n\tname = Dev\n\temail = dev@ordering.example\n[init]\n\tdefaultBranch = main\n');
  const env = { ...process.env, PATH: `${NODEDIR}:/usr/bin:/bin:/usr/sbin:/sbin:${dirname(execFileSync('bash', ['-c', 'command -v claude'], { encoding: 'utf8' }).trim())}`, GIT_CONFIG_GLOBAL: gc, NO_COLOR: '1' };
  const a = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--model', MODEL, '--effort', EFFORT, '--max-turns', '100', '--max-budget-usd', '2',
    '--restricted', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence', '--permission-mode', 'acceptEdits', '--settings', JSON.stringify(settings),
    '--tools', 'Read,Write,Edit,Glob,Grep,Bash', '--allowed-tools', 'Read,Write,Edit,Glob,Grep,Bash', ...add];
  const raw = await new Promise((done) => { const ch = spawn('claude', a, { cwd: w, env, stdio: ['ignore', 'pipe', 'pipe'] }); const o = []; ch.stdout.on('data', (d) => o.push(d)); ch.on('close', () => done(Buffer.concat(o).toString())); });
  writeFileSync(join(root, 'stream.jsonl'), raw);
  let init = {}, res = {}, last = ''; const tools = {}, bash = [];
  for (const l of raw.split('\n')) { let e; try { e = JSON.parse(l); } catch { continue; }
    if (e.type === 'system' && e.subtype === 'init') init = e; if (e.type === 'result') res = e;
    if (e.type === 'assistant') for (const p of e.message?.content ?? []) { if (p.type === 'tool_use') { tools[p.name] = (tools[p.name] ?? 0) + 1; if (p.name === 'Bash') bash.push(p.input.command); } if (p.type === 'text') last = p.text; } }
  const denials = (res.permission_denials ?? []).length; writeFileSync(join(root, 'answer.md'), res.result ?? last); writeFileSync(join(root, 'bash.txt'), bash.join('\n---\n'));
  const git = (...x) => { try { return execFileSync('git', x, { cwd: w, encoding: 'utf8', env: { ...env } }); } catch (e) { return `ERR ${e.message}`; } };
  writeFileSync(join(root, 'git-log.txt'), git('log', '--graph', '--all', '--format=%h %an | %s %d', '-n', '30'));
  writeFileSync(join(root, 'git-status.txt'), git('status', '--porcelain=v1', '-uall') + '\n' + git('branch', '-a'));
  writeFileSync(join(root, 'final.diff'), git('diff', 'HEAD') + git('diff', '--cached'));
  if (c.out && existsSync(join(w, c.out))) copyFileSync(join(w, c.out), join(root, c.out));
  writeFileSync(join(root, 'meta.json'), JSON.stringify({ id, case: cs, skill: skill ?? '-', model: init.model, requested: MODEL, effort: EFFORT, claude_code_version: init.claude_code_version, skills: init.skills, mcp_servers: init.mcp_servers, tools, denials, cost: res.total_cost_usd, turns: res.num_turns, subtype: res.subtype }, null, 1));
  console.log(`${id} ${cs} skill=${skill ?? '-'} model=${init.model} cost=${(res.total_cost_usd ?? 0).toFixed(3)} turns=${res.num_turns} ${res.subtype}`);
}
const argv = process.argv.slice(2); const pi = argv.indexOf('--parallel'); const PAR = pi >= 0 ? Number(argv[pi + 1]) : 3;
const q = argv.filter((x, i) => x.includes(':') && (pi < 0 || i !== pi + 1));
await Promise.all(Array.from({ length: Math.min(PAR, q.length) }, async () => { while (q.length) { const s = q.shift(); try { await runOne(s); } catch (e) { console.log(`${s} FAILED ${e.message}`); } } }));
