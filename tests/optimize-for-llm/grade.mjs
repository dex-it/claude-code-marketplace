#!/usr/bin/env node
// Дословная половина инвариантов набора. Смысловую он не закрывает - она судится чтением
// финального текста: вердикт здесь вход сверки, не приговор.
//
//   node grade.mjs <корень рабочего дерева прогона>
//
// Дерево: <корень>/c01/<файл>, ... Исходники берутся из inputs/ рядом с этим скриптом.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2];
if (!ROOT) {
  console.error('нужен путь к рабочему дереву прогона');
  process.exit(2);
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const body = (s) => s.replace(/^---\n[\s\S]*?\n---\n/, '');
const front = (s) => (s.match(/^---\n[\s\S]*?\n---\n/) || [''])[0];

const CASES = [
  {
    id: 'O-01', out: 'c01/redis-cache-keys.md', src: 'in-01-trap-skill.md',
    mines: ['TTL=300', 'widget:{id}', 'только', 'а не `KEYS`'],
    cut: ['Стоит отметить', 'давайте рассмотрим', 'dotnet add package StackExchange.Redis',
          'Здесь мы вызываем метод', 'Имя ключа следует составлять'],
  },
  {
    id: 'O-02', out: 'c02/dependency-auditor.md', src: 'in-02-agent-phases.md',
    mines: ['ТОЛЬКО', '`n/a`', 'npm view', 'не только'],
    cut: ['важная часть гигиены', 'sudo apt install ripgrep',
          'Также агент не занимается правкой манифестов самостоятельно'],
  },
  {
    id: 'O-03', out: 'c03/dependency-auditor.md', src: 'in-02-agent-phases.md',
    mines: ['ТОЛЬКО', '`n/a`', 'не только'],
    cut: ['важная часть гигиены', 'sudo apt install ripgrep'],
    note: 'исход по абзацу самопроверки судится чтением: назван статус или сверка со страницей тира',
  },
  {
    id: 'O-04', out: 'c04/dependency-auditor.md', src: 'in-02-agent-phases.md',
    mines: ['ТОЛЬКО', '`n/a`', 'не только'],
    cut: ['важная часть гигиены', 'sudo apt install ripgrep', 'Перед выводом перепроверь'],
  },
  {
    id: 'O-05', out: 'c05/pg-slow-query.md', src: 'in-03-description.md',
    mines: ['Активируется при', 'PostgreSQL', 'ANALYZE', 'Index Scan'],
    cut: ['Я помогу тебе', 'когда ты видишь', 'high shared_blks_read',
          'hash join spills to disk', 'nested loop на большой выборке'],
  },
  {
    id: 'O-06', out: 'c06/migration-writer.md', src: 'in-04b-migration-agent.md',
    mines: ['ТОЛЬКО', 'pg_stat_user_tables'],
    cut: ['цена ошибки заметно выше', 'dotnet tool install --global dotnet-ef',
          'Здесь агент пишет два метода'],
  },
  {
    id: 'O-07', out: 'c07/release-check.md', src: 'in-05-prose-order.md',
    mines: ['--first-parent', 'десяти минут', 'а не'],
    cut: ['Итак', 'стоит отметить', 'в целом', 'как правило', 'при необходимости можно также'],
  },
  {
    id: 'O-08', out: 'c08/lock-ordering.md', src: 'in-06-dense.md',
    mines: ['TryAcquire(timeout)', 'а не', 'появления в коде'],
    cut: [],
  },
];

let failures = 0;
for (const c of CASES) {
  const after = readFileSync(join(ROOT, c.out), 'utf8');
  const before = readFileSync(join(HERE, 'inputs', c.src), 'utf8');
  const flat = norm(after);
  const dBody = Buffer.byteLength(body(after)) - Buffer.byteLength(body(before));
  const dFront = Buffer.byteLength(front(after)) - Buffer.byteLength(front(before));
  const lost = c.mines.filter((m) => !flat.includes(norm(m)));
  const kept = c.cut.filter((m) => flat.includes(norm(m)));
  const zero = c.cut.length > 0 && dBody === 0;
  const bad = lost.length || kept.length || zero;
  if (bad) failures++;
  const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);
  console.log(`${bad ? 'ПРОВАЛ' : 'ok    '} ${c.id}  тело ${sign(dBody)} б, поле ${sign(dFront)} б`);
  if (lost.length) console.log(`         мина не найдена: ${lost.join(' | ')}`);
  if (kept.length) console.log(`         рез не сделан: ${kept.join(' | ')}`);
  if (zero) console.log('         дельта тела = 0 при непустом обязательном резе');
  if (c.note) console.log(`         (${c.note})`);
}
console.log(`\nДословная половина: ${CASES.length - failures}/${CASES.length}. Смысловая - чтением выходов.`);
