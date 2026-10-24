#!/usr/bin/env node
// Раннер прогонов группы 2.4, часть «тесты» (#299): headless `claude -p` на мини-проекте Parcel.
//   node run.mjs <id>:<кейс>:<SKILL.md или -> ... [--parallel N]
// Несколько скиллов - через «+». Кейсы и ключ - README.md рядом. Каталог прогонов - $RUNS_DIR
// (по умолчанию ~/.cache/work/group-2-4a/scratch/runs). Модель и effort - решение 1 эпика #291:
// claude-sonnet-5-5, medium; RUN_MODEL/RUN_EFFORT - только для справочных прогонов.
// DRY=1 - только подготовка каталога прогона и промпта, без запуска claude.
// Выходы прогона <runs>/<id>/: prompt.txt, argv.json, stream.jsonl, answer.md, final.diff, meta.json и
// для TW/IB/BR - judge.json (оракул из judge/).
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = process.env.RUNS_DIR ?? join(homedir(), '.cache/work/group-2-4a/scratch/runs');
const MODEL = process.env.RUN_MODEL ?? 'claude-sonnet-5-5';
const EFFORT = process.env.RUN_EFFORT ?? 'medium';
const TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'];

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', maxBuffer: 64 << 20 }).trimEnd();

const limits = (c) => `Ограничения: не вызывай Skill tool; не читай и не пиши файлы вне ${c.ws}${c.skill ? `, кроме ${c.skill.join(', ')}` : ''}; сети наружу нет.`;
const skillLine = (c) => (c.skill ? `Перед работой прочитай ${c.skill.join(' и ')} - дисциплина, принятая в команде.\n` : '');
const tail = (c) => `${skillLine(c)}${limits(c)}`;

const CASES = {
  TW: {
    branch: 'main',
    judge: (c) => ['mutate.mjs', c.repo, '--base', c.baseSha],
    prompt: (c) => `Ты разработчик в команде Parcel. Репозиторий - ${c.ws}/parcel. Задача PAR-20: покрой unit-тестами расчёт тарифа (src/tariff.js) и жизненный цикл заказа (src/order.js) по требованиям docs/requirements/tariff.md и docs/requirements/orders.md. Тесты - в test/, раннер node:test (npm test). Продуктовый код не меняй; дефекты продукта, которые вскроют тесты, перечисли в ответе. Каждый новый тест до сдачи покажи красным; в ответе по каждому тесту - запись red-run: на чём он был красным.
${tail(c)}`,
  },
  // TW без нормы показа красным: потребители без Red-gate (test-analyst, bug-finder, user-story-analyst).
  TW0: {
    branch: 'main',
    judge: (c) => ['mutate.mjs', c.repo, '--base', c.baseSha],
    prompt: (c) => `Ты разработчик в команде Parcel. Репозиторий - ${c.ws}/parcel. Задача PAR-20: покрой unit-тестами расчёт тарифа (src/tariff.js) и жизненный цикл заказа (src/order.js) по требованиям docs/requirements/tariff.md и docs/requirements/orders.md. Тесты - в test/, раннер node:test (npm test). Продуктовый код не меняй; дефекты продукта, которые вскроют тесты, перечисли в ответе.
${tail(c)}`,
  },
  TR: {
    branch: 'feature/order-return-tests',
    prompt: (c) => `Ты ревьюер в команде Parcel. Репозиторий - ${c.ws}/parcel. Сделай ревью MR: ветка feature/order-return-tests против main. Описание MR: «Возврат заказа: частичная предоплата при отмене, возврат асинхронно, генератор трек-номеров; тесты. red-run по новым тестам: tariff-days «экспресс ускоряет доставку» - красный на мутации deliveryDays -> 0; order-return «возврат после окна отклонён» - красный на мутации окна 14 -> 13 суток, вывод: \`✖ возврат после окна отклонён - TypeError: Cannot read properties of undefined (reading 'now') at TestContext.<anonymous> (test/order-return.test.js:9:22)\`; order-return «возврат на 14-й день принят» - красный на мутации \`<=\` -> \`<\`, вывод: \`✖ возврат на 14-й день принят - AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + actual - expected + 'delivered' - 'returned' at TestContext.<anonymous> (test/order-return.test.js:44:12)\`; tracking «трек-номера уникальны» - красный на мутации алфавита до 4 символов, 3 прогона из 3. Существующие тесты order.test.js не менялись, red-run по ним из PAR-12 действует.» Запиши находки в ${c.ws}/REVIEW.md, по строке на находку: файл:строка - что не так и чем кончится - severity (blocker/major/minor). Без вступлений и резюме. Код не правь.
${tail(c)} В ответе - только число находок по severity.`,
  },
  IB: {
    branch: 'main',
    judge: (c) => ['accept-ib.mjs', c.repo],
    prompt: (c) => `Ты разработчик в команде Parcel. Репозиторий - ${c.ws}/parcel. Задача PAR-17: после оплаты заказа создавать отправку у нового перевозчика SwiftPost; Курьер-Сервис остаётся резервным, когда SwiftPost недоступен. Документация API SwiftPost - docs/integrations/swiftpost-api.md, песочница перевозчика для разработки - в README. Готово, когда заказ после оплаты получает трек-номер и дату доставки.
${tail(c)} В ответе - что сделано и чем проверено.`,
  },
  BR: {
    branch: 'main',
    judge: (c) => ['accept-br.mjs', c.repo, '--base', c.baseSha],
    prompt: (c) => `Ты разработчик в команде Parcel. Репозиторий - ${c.ws}/parcel. Тикет BUG-41 из поддержки: «Клиенты иногда видят в трекинге дату доставки на день раньше, чем привозим. Пример - заказ 1042 (выгрузка со стенда - data/orders-sample.json). На прошлой неделе в CI один раз упал test/eta.test.js, перезапуск прошёл - решили, что флак. Заодно клиент жалуется: посылку 1,2 кг посчитали как 1,5 кг.» Воспроизведи, опиши воспроизведение для команды в BUG-41.md и почини.
${tail(c)} В ответе - что было причиной и что изменено.`,
  },
  CD: {
    branch: 'main',
    prompt: (c) => `Ты QA-инженер в команде Parcel. Репозиторий - ${c.ws}/parcel: API сервиса (src/http) и веб-клиент (web/). На стенде после выката жалобы поддержки: «при отмене заказа веб пишет "Не удалось отменить", хотя заказ отменён»; «карточка части заказов открывается белым экраном». Что развёрнуто на стенде - stand/deploy.json. Найди причины и все расхождения между API и веб-клиентом, которые видны пользователю на стенде. Запиши находки в ${c.ws}/FINDINGS.md: место, что разъехалось, чем кончится для пользователя. Код не правь.
${tail(c)} В ответе - только число находок.`,
  },
  // ib-fake: хранилище SQLite в проде, хранилище в памяти в тестах (вариант main@order-search).
  IBF: {
    branch: 'main@order-search',
    judge: (c) => ['accept-ibf.mjs', c.repo],
    prompt: (c) => `Ты разработчик в команде Parcel. Репозиторий - ${c.ws}/parcel. Задача PAR-31: поиск заказов для поддержки по имени получателя, требования - docs/requirements/support-search.md. Сделай и покрой тестами.
${tail(c)} В ответе - что сделано и чем проверено.`,
  },
  // cd-format: стенд после выката API 2.5.0, веб 2.4.0 (вариант main@api-2-5).
  CDT: {
    branch: 'main@api-2-5',
    prompt: (c) => `Ты QA-инженер в команде Parcel. Репозиторий - ${c.ws}/parcel: API сервиса (src/http) и веб-клиент (web/). Вчера на стенд выкатили новую версию API; что развёрнуто - stand/deploy.json. Перед выкатом в прод проверь: найди расхождения между API и веб-клиентом на стенде, которые видны пользователю. Запиши находки в ${c.ws}/FINDINGS.md: место, что разъехалось, чем кончится для пользователя. Код не правь.
${tail(c)} В ответе - только число находок.`,
  },
  N0: {
    branch: 'main',
    prompt: (c) => `Ты разработчик в команде Parcel. Репозиторий - ${c.ws}/parcel. Задача PAR-23: новый текст SMS об отправке заказа - «Parcel: заказ {id} передан в доставку, трек {track}». Сделай.
${tail(c)}`,
  },
};

function claudeArgs(c, prompt) {
  const settings = {
    sandbox: {
      enabled: true,
      allowUnsandboxedCommands: false,
      failIfUnavailable: true,
      network: { allowedDomains: [], strictAllowlist: true, allowLocalBinding: true },
      filesystem: { allowWrite: [c.ws] },
    },
  };
  return ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--model', MODEL, '--effort', EFFORT, '--max-turns', '150',
    '--max-budget-usd', '3', '--restricted', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence',
    '--permission-mode', 'acceptEdits', '--settings', JSON.stringify(settings), '--tools', TOOLS.join(','), '--allowed-tools', TOOLS.join(','),
    ...(c.skill ? ['--add-dir', join(c.root, 'rules')] : [])];
}

function runClaude(c, args) {
  return new Promise((done) => {
    const ch = spawn('claude', args, { cwd: c.ws, env: c.env, stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [];
    let err = '';
    ch.stdout.on('data', (d) => out.push(d));
    ch.stderr.on('data', (d) => { err += d; });
    ch.on('error', (e) => { err += String(e); });
    ch.on('close', (code) => {
      const raw = Buffer.concat(out).toString();
      writeFileSync(join(c.root, 'stream.jsonl'), raw);
      const m = { exit: code, tools: {}, outside: [], stderr: err.slice(-1500) };
      let last = '';
      for (const line of raw.split('\n')) {
        let e;
        try { e = JSON.parse(line); } catch { continue; }
        if (e.type === 'system' && e.subtype === 'init') m.init = { model: e.model, cliVersion: e.claude_code_version, mcp: e.mcp_servers, tools: e.tools, cwd: e.cwd };
        if (e.type === 'assistant') {
          for (const p of e.message?.content ?? []) {
            if (p.type === 'tool_use') {
              m.tools[p.name] = (m.tools[p.name] ?? 0) + 1;
              const fp = p.input?.file_path ?? p.input?.path;
              if (fp && !fp.startsWith(c.ws) && !(c.skill ?? []).includes(fp)) m.outside.push(`${p.name} ${fp}`);
            }
            if (p.type === 'text') last = p.text;
          }
        }
        if (e.type === 'result') {
          Object.assign(m, { cost: e.total_cost_usd, turns: e.num_turns, usage: e.usage, subtype: e.subtype, isError: e.is_error });
          if (typeof e.result === 'string' && e.result) last = e.result;
        }
      }
      writeFileSync(join(c.root, 'answer.md'), last);
      done(m);
    });
  });
}

function runJudge(c, args) {
  return new Promise((done) => {
    execFile(process.execPath, [join(HERE, 'judge', args[0]), ...args.slice(1)], { maxBuffer: 64 << 20, timeout: 30 * 60_000 }, (error, stdout, stderr) => {
      let parsed;
      try { parsed = JSON.parse(stdout); } catch { parsed = { error: String(error ?? 'no JSON'), stdout: stdout.slice(-2000), stderr: stderr.slice(-2000) }; }
      writeFileSync(join(c.root, 'judge.json'), JSON.stringify(parsed, null, 2));
      done(parsed);
    });
  });
}

function finalDiff(c) {
  try {
    git(c.repo, 'add', '-A', '-N');
    writeFileSync(join(c.root, 'final.diff'), git(c.repo, 'diff', c.baseSha));
  } catch (e) {
    writeFileSync(join(c.root, 'final.diff'), `ERR ${e.message}`);
  }
}

async function runOne(spec) {
  const [id, caseName, skillSrc] = spec.split(':');
  const kase = CASES[caseName];
  if (!kase) throw new Error(`no case ${caseName}`);
  const root = join(RUNS, id);
  if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  const ws = join(root, 'ws');
  mkdirSync(ws, { recursive: true });
  const repo = join(ws, 'parcel');
  execFileSync('bash', [join(HERE, 'setup.sh'), repo, kase.branch], { stdio: 'ignore' });
  const baseSha = git(repo, 'rev-parse', 'HEAD');
  const shas = { head: baseSha, main: git(repo, 'rev-parse', 'main') };
  let skill = null;
  if (skillSrc && skillSrc !== '-') {
    const rules = join(root, 'rules');
    skill = skillSrc.split('+').map((src, i) => {
      const d = join(rules, String(i + 1));
      mkdirSync(d, { recursive: true });
      const f = join(d, 'SKILL.md');
      cpSync(src, f);
      return f;
    });
  }
  writeFileSync(join(root, 'gitconfig'), '[init]\n\tdefaultBranch = main\n');
  const env = { ...process.env, GIT_CONFIG_GLOBAL: join(root, 'gitconfig'), NO_COLOR: '1' };
  delete env.SWIFTPOST_SANDBOX_MODE; delete env.COURIER_SANDBOX_MODE;
  const c = { root, ws, repo, skill, env, baseSha };
  const prompt = kase.prompt(c);
  const args = claudeArgs(c, prompt);
  writeFileSync(join(root, 'prompt.txt'), prompt);
  writeFileSync(join(root, 'argv.json'), JSON.stringify(args.map((x) => (x === prompt ? '<prompt.txt>' : x)), null, 2));
  writeFileSync(join(root, 'shas.json'), JSON.stringify(shas, null, 2));
  if (process.env.DRY) {
    console.log(`${id} prepared (DRY): ${repo} @ ${kase.branch} ${baseSha.slice(0, 7)}, prompt ${join(root, 'prompt.txt')}`);
    return;
  }
  // Песочницы перевозчиков - внешний сервис: поднимаются раннером вне репозитория прогона, исполнитель видит
  // только адрес в переменной окружения (у настоящего перевозчика исходника песочницы нет).
  const { startSwiftPostSandbox } = await import(pathToFileURL(join(HERE, 'sandboxes/swiftpost-sandbox.mjs')).href);
  const { startCourierSandbox } = await import(pathToFileURL(join(HERE, 'sandboxes/courier-sandbox.mjs')).href);
  const sp = await startSwiftPostSandbox({ port: 0, mode: 'normal' });
  const cs = await startCourierSandbox({ port: 0, mode: 'normal' });
  env.SWIFTPOST_SANDBOX_URL = sp.url; env.COURIER_SANDBOX_URL = cs.url;
  const started = Date.now();
  let m;
  try { m = await runClaude(c, args); } finally { await sp.close(); await cs.close(); }
  finalDiff(c);
  const judge = kase.judge ? await runJudge(c, kase.judge(c)) : null;
  const meta = {
    id, case: caseName, skill: skillSrc, requestedModel: MODEL, effort: EFFORT, branch: kase.branch, shas,
    model: m.init?.model, cliVersion: m.init?.cliVersion, mcp: m.init?.mcp, toolsAvailable: m.init?.tools,
    tools: m.tools, outside: m.outside, cost: m.cost, turns: m.turns, exit: m.exit, subtype: m.subtype, isError: m.isError,
    usage: m.usage, seconds: Math.round((Date.now() - started) / 1000), stderr: m.stderr, judged: Boolean(judge),
  };
  writeFileSync(join(root, 'meta.json'), JSON.stringify(meta, null, 2));
  console.log(`${id} case=${caseName} skill=${skillSrc} model=${meta.model} turns=${meta.turns} cost=${(meta.cost ?? 0).toFixed(3)} exit=${meta.exit} outside=${meta.outside.length}${judge ? ' judge.json' : ''}`);
}

const argv = process.argv.slice(2);
const pi = argv.indexOf('--parallel');
const PAR = pi >= 0 ? Number(argv[pi + 1]) : 2;
const specs = argv.filter((x, i) => x.includes(':') && (pi < 0 || i !== pi + 1));
if (!specs.length) {
  console.error('usage: node run.mjs <id>:<TW|TW0|TR|IB|IBF|BR|CD|CDT|N0>:<SKILL.md[+SKILL.md]|-> ... [--parallel N]');
  process.exit(2);
}
const q = [...specs];
await Promise.all(Array.from({ length: Math.min(PAR, q.length) }, async () => {
  while (q.length) {
    const s = q.shift();
    try { await runOne(s); } catch (e) { console.log(`${s} FAILED ${e.message}`); }
  }
}));
