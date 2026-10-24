#!/usr/bin/env node
// Оракул TW: мутанты judge/mutants.json против тестов репозитория.
//   node judge/mutate.mjs <repo> [--base main] [--keep]
// Репозиторий копируется во временный каталог, src/ берётся из базы (правки исполнителя в продукте на
// оракул не влияют). Множество тестов, зелёных на базе, - эталон; мутант убит, если хотя бы один тест
// из множества на мутанте красный. Каждый тест-файл - отдельный прогон node --test --test-reporter=tap,
// таймаут 60 с. Вывод - JSON в stdout.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyRepo, parseArgs, pool, restoreSrc, runTestFile, testFiles } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const { repo, base, keep } = parseArgs(process.argv.slice(2));
const mutants = JSON.parse(readFileSync(join(HERE, 'mutants.json'), 'utf8'));

const work = copyRepo(repo, 'mutate');
restoreSrc(work, base);
const files = testFiles(work);

async function runAll() {
  const perFile = await pool(files, 4, (f) => runTestFile(work, f));
  return perFile.flat();
}

const baseline = await runAll();
const green = new Set(baseline.filter((e) => e.ok && !e.skip).map((e) => e.name));
const result = {
  repo,
  base,
  testFiles: files,
  baselineGreen: green.size,
  baselineFailing: baseline.filter((e) => !e.ok).map((e) => e.name),
  mutants: {},
};

for (const m of mutants) {
  const path = join(work, m.file);
  const original = readFileSync(path, 'utf8');
  const count = original.split(m.find).length - 1;
  if (count !== 1) {
    result.mutants[m.id] = { killed: false, by: [], error: `find встречается ${count} раз в ${m.file}` };
    continue;
  }
  writeFileSync(path, original.replace(m.find, m.replace));
  try {
    const entries = await runAll();
    const byName = new Map(entries.map((e) => [e.name, e]));
    const crashed = entries.filter((e) => !e.ok && !green.has(e.name)).map((e) => e.name.split(' > ')[0]);
    const by = [...green].filter((n) => {
      const e = byName.get(n);
      return e ? !e.ok : crashed.includes(n.split(' > ')[0]);
    });
    result.mutants[m.id] = { killed: by.length > 0, by };
  } finally {
    writeFileSync(path, original);
  }
}

result.summary = {
  total: mutants.length,
  killed: Object.values(result.mutants).filter((x) => x.killed).length,
  alive: Object.entries(result.mutants).filter(([, x]) => !x.killed).map(([id]) => id),
};
if (!keep) rmSync(work, { recursive: true, force: true });
console.log(JSON.stringify(result, null, 2));
