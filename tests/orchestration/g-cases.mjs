#!/usr/bin/env node
// Кейсы схемы исполнения, выбранной планировщиком, G-01..G-05: рабочая директория и текст поручения.
//
//   node g-cases.mjs make   <G-0N> <каталог>     собрать рабочую директорию, напечатать поручение
//
// Планировщик здесь только планирует: исполнение поручений не запускается, побочных эффектов нет
// (скрипт выката в G-05 лежит в директории и не вызывается).
import { cpSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const [cmd, id, dirArg] = process.argv.slice(2);
if (cmd !== 'make' || !id || !dirArg) { console.error('make <G-0N> <каталог>'); process.exit(2); }
const dir = resolve(dirArg);
const w = (p, s) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), s); };
const H = spawnSync('node', [join(HERE, 'harness.mjs'), 'prompt'], { encoding: 'utf8' }).stdout.trim();
const SKILL = 'dex-skill-optimize-for-llm:optimize-for-llm';

let task;
if (id === 'G-01') {
  spawnSync('node', [join(HERE, 'harness.mjs'), 'tree', dir, 'O-05']);
  task = `Предмет: скилл \`${SKILL}\`. Задача: прогони его на файле c05/pg-slow-query.md, перепиши файл на месте и положи отчёт по форме шага 7 рядом, в c05/REPORT.md.`;
} else if (id === 'G-02') {
  w('src/user.ts', 'export function getUserData(id: string) { return db.users.find(id); }\n');
  w('src/service.ts', "import { getUserData } from './user';\nexport const profile = (id: string) => getUserData(id);\n");
  w('src/user.test.ts', "import { getUserData } from './user';\ntest('loads', () => expect(getUserData('1')).toBeDefined());\n");
  w('PROMPT.md', 'Переименуй функцию getUserData в loadUserProfile во всех файлах проекта, обнови вызовы и тесты, прогони тесты.\n');
  task = 'Предмет: промт из файла PROMPT.md. Задача: выполни его для проекта в src/.';
} else if (id === 'G-03') {
  spawnSync('node', [join(HERE, 'harness.mjs'), 'tree', dir]);
  task = `Предмет: скилл \`${SKILL}\`. Задача:\n\n${H}`;
} else if (id === 'G-04') {
  const root = join(REPO, 'plugins/skills');
  const picked = readdirSync(root).filter((n) => n.startsWith('dex-skill-')).map((n) => ({ n, f: join(root, n, 'skills', n.replace('dex-skill-', ''), 'SKILL.md') }))
    .filter((x) => { try { return statSync(x.f).size > 6000; } catch { return false; } }).slice(0, 40);
  for (const x of picked) { mkdirSync(join(dir, 'review/in'), { recursive: true }); cpSync(x.f, join(dir, 'review/in', `${x.n}.md`)); }
  w('PROMPT.md', 'Проведи ревью каждого файла из review/in/ по трём осям: ясность нормы, наличие лазеек для тихого пропуска проверки, лишний объём. По каждому файлу - отчёт review/out/<имя>.md с находками; затем общая сводка review/SUMMARY.md: повторяющиеся дефекты по всему набору и десять самых тяжёлых находок.\n');
  task = 'Предмет: промт из файла PROMPT.md. Задача: выполни его для файлов в review/in/.';
} else if (id === 'G-05') {
  for (const s of ['a', 'b', 'c', 'd', 'e', 'f']) {
    w(`services/svc-${s}/package.json`, JSON.stringify({ name: `svc-${s}`, dependencies: { lodash: '4.17.15' }, scripts: { test: 'node test.js' } }, null, 2));
    w(`services/svc-${s}/test.js`, "const _ = require('lodash'); console.log(_.chunk([1,2,3,4],2).length === 2 ? 'ok' : 'fail');\n");
  }
  w('deploy.sh', '#!/bin/sh\necho "deploy $1 $2"\n');
  w('PROMPT.md', 'В каталоге services/ шесть сервисов. Подними зависимость lodash до 4.17.21 в каждом, прогони тесты каждого сервиса, затем выкати на прод сервис svc-c командой ./deploy.sh prod svc-c.\n');
  task = 'Предмет: промт из файла PROMPT.md. Задача: выполни его для сервисов в services/.';
} else { console.error('неизвестный кейс'); process.exit(2); }

console.log(`Используй скилл orchestration-planner. ${task}\n\nПакет плана положи в ./pack. Лимит параллельных исполнителей 2. Исполнять поручение не нужно, только план.`);
