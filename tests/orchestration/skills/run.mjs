#!/usr/bin/env node
// Набор «скиллы задач»: дан один промт - скиллы подбираются из доступных; дан скилл - работа идёт с ним.
//
//   node run.mjs <каталог> --role exec|plan --set pick|given|folder|forkplan|mix --model M --effort E [--fork 0|1] [--budget 6]
//
// exec: оркестратор по скиллу `orchestration-executor` выполняет пакет и четыре задачи, добавленные
//       пользователем (notes/<set>.txt); оценка - grade.py.
// plan: планировщик по скиллу `orchestration-planner` готовит пакет (в <каталог>/pack); оценка -
//       grade_plan.py. Наборы: pick, given, folder (три работы; folder - с каталогом промтов) и mix
//       (шесть работ экзамена способов: кто исполняет и сколько).
// plan temp: три ревью одной методики при каталоге промтов без подходящего - временный промт пакета.
// Наборы exec: pick, given, folder (пять добавленных задач, пакет с `prompts_dir`), forkplan (задача плана
//       с исполнителем `fork`; запуск с --fork 1 и --fork 0).
// Доступные скиллы - четыре плагина-фикстуры из <каталог>_plugins (gen.py), подключены `--plugin-dir`.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };

// Среда прогона изолирована от оператора (правило tests/README.md, «Среда прогона раннеров `claude -p`»): `--restricted`
// раннеру не подходит - ему нужны Bash и `bypassPermissions`, - поэтому источники настроек сужены до проекта, а MCP
// пользователя отрезаны. Плагины и скиллы подаются `--plugin-dir`. `OPERATOR_ENV=1` снимает изоляцию.
const ISOLATION = process.env.OPERATOR_ENV ? [] : ['--setting-sources', 'project', '--strict-mcp-config'];

const dir = resolve(process.argv[2] ?? '');
const role = arg('role', 'exec');
const set = arg('set', 'pick');
const model = arg('model', 'sonnet');
const effort = arg('effort', 'high');
const fork = arg('fork', '1');
const budget = arg('budget', '6');
if (!['exec', 'plan'].includes(role) || !['pick', 'given', 'folder', 'forkplan', 'mix', 'temp'].includes(set)) { console.error('--role exec|plan --set pick|given|folder|forkplan|mix|temp'); process.exit(2); }

const mix = set === 'mix' || set === 'temp';
const built = mix
  ? spawnSync('python3', ['-I', join(HERE, '../modes/gen.py'), dir], { encoding: 'utf8' })
  : spawnSync('python3', ['-I', join(HERE, 'gen.py'), dir, '--set', set, ...(role === 'plan' ? ['--no-pack'] : [])], { encoding: 'utf8' });
if (built.status !== 0) { console.error(built.stderr); process.exit(2); }
if (mix) spawnSync('rm', ['-rf', join(dir, 'pack')]);
if (set === 'temp') spawnSync('cp', ['-R', join(HERE, 'fixture/prompts'), join(dir, 'prompts')]);

const fx = mix ? [] : ['fx-csv', 'fx-notes', 'fx-sql', 'fx-export'].flatMap((p) => ['--plugin-dir', join(`${dir}_plugins`, p)]);
const PLUGINS = join(REPO, 'tests/orchestration/subject');
let prompt;
let plugins;
let extra = [];
if (role === 'exec') {
  prompt = `Используй скилл orchestration-executor: выполни пакет плана в ./pack.\n\n${readFileSync(join(HERE, 'notes', `${set}.txt`), 'utf8')}`;
  plugins = ['dex-skill-orchestration-executor'];
} else {
  const subject = set === 'given' ? 'Предмет: скилл `fx-csv:csv-audit`. ' : '';
  const folder = ['folder', 'temp'].includes(set) ? 'Каталог промтов: ./prompts (его файлы можно брать как опору для работ). ' : '';
  let work;
  if (set === 'temp') {
    work = 'Проведи ревью отказоустойчивости трёх групп модулей из src/p: c01-c08, c09-c16, c17-c24. Для каждой ' +
      'группы - отчёт в out/rev-<номер группы>.md: найденные риски с указанием файла и функции, серьёзность ' +
      '(низкая, средняя, высокая) и рекомендуемая правка. Три независимых ревью по одной методике.';
  } else if (mix) {
    const ex = readFileSync(join(HERE, '../modes/notes/exam.txt'), 'utf8').split('\n').slice(2).join('\n');
    work = `В рабочей директории шесть независимых работ (пути от рабочей директории).\n\n${ex}`;
  } else {
    work = 'В рабочей директории независимые работы.\n' +
      '1. Проверь data.csv на дубли и пустые значения; результат - отчёт в out/s1.md.\n' +
      '2. По списку изменений CHANGES.txt подготовь заметки о выпуске в out/s2.md.\n' +
      '3. Переведи docs/note.txt на английский, результат - out/s3.txt.\n' +
      (set === 'folder' ? '4. Для каждого из inventory/a.json, inventory/b.json, inventory/c.json запиши в out/s5-<имя>.txt одну строку `items=<число позиций> total=<сумма price*qty>`.\n' : '');
  }
  prompt = `Используй скилл orchestration-planner. ${subject}${folder}Задача пользователя:\n\n${work}\n\n` +
    'Пакет плана положи в ./pack. Лимит параллельных исполнителей 2. Оркестрировать вопреки признакам: ' +
    'это проверка формата пакета, схема orchestrate.';
  plugins = ['dex-skill-orchestration-planner', 'dex-skill-orchestration-executor'];
  extra = ['--disallowedTools', 'Agent'];
}
const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--no-session-persistence',
  '--permission-mode', 'bypassPermissions', '--max-budget-usd', budget,
  ...plugins.flatMap((p) => ['--plugin-dir', join(PLUGINS, p)]), ...fx, ...extra,
  '--model', model, '--effort', effort, ...ISOLATION];
const r = spawnSync('claude', args, {
  cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 20 * 60 * 1000,
  env: { ...process.env, CLAUDE_CODE_FORK_SUBAGENT: fork },
});
writeFileSync(join(dir, 'stream.jsonl'), r.stdout ?? '');
const grader = role === 'exec' ? 'grade.py' : 'grade_plan.py';
const g = spawnSync('python3', ['-I', join(HERE, grader), dir, '--set', set, '--orch', model, '--fork', fork], { encoding: 'utf8' });
process.stdout.write(g.stdout || g.stderr);
