#!/usr/bin/env node
/**
 * Propagation cost каталога: доля элементов, до которых в среднем доходит правка одного.
 *
 * Метод - MacCormack, Baldwin, Rusnak: строится DSM «элемент x элемент», берётся её
 * транзитивное замыкание (visibility matrix), метрика = плотность замыкания. Точка отсчёта
 * авторов: Mozilla до перепроектирования 17.35%, после - 2.78%.
 *
 * Элемент - скилл (со всеми файлами своей директории) либо агент. Ребро A -> B: тело A
 * называет B. Правило ребра задаётся флагом, потому что число без правила бессмысленно:
 *   --rule=canonical  только каноническая форма `плагин:имя` в бэктиках
 *   --rule=loose      каноническая форма ИЛИ голое имя элемента в бэктиках (дефолт)
 *
 * Границу метрики называем сами: документальная перекрёстная ссылка считается зависимостью.
 * Для вопроса «куда расходится правка» это верное прочтение - переименовали раздел, и
 * ссылающийся текст надо править; для вопроса «что сломается в рантайме» - нет.
 *
 * Usage:
 *   node tools/propagation-cost.js                     # loose, кратко
 *   node tools/propagation-cost.js --rule=canonical
 *   node tools/propagation-cost.js --json              # машинный вывод
 *   node tools/propagation-cost.js --top=10            # плюс самые «расходящиеся» элементы
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = process.env.MARKETPLACE_ROOT
  ? resolve(process.env.MARKETPLACE_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PLUGINS_DIR = join(REPO_ROOT, 'plugins');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function pluginOf(path) {
  let dir = dirname(path);
  while (dir.startsWith(PLUGINS_DIR)) {
    if (existsSync(join(dir, '.claude-plugin', 'plugin.json'))) return basename(dir);
    dir = dirname(dir);
  }
  return null;
}

function collectElements() {
  const elements = [];
  for (const file of walk(PLUGINS_DIR)) {
    const plugin = pluginOf(file);
    if (!plugin) continue;

    if (file.endsWith('/SKILL.md')) {
      const skillDir = dirname(file);
      elements.push({
        id: `${plugin}:${basename(skillDir)}`,
        kind: 'skill',
        plugin,
        name: basename(skillDir),
        files: walk(skillDir),
      });
    } else if (file.includes('/agents/') && file.endsWith('.md')) {
      elements.push({
        id: `${plugin}:${basename(file, '.md')}`,
        kind: 'agent',
        plugin,
        name: basename(file, '.md'),
        files: [file],
      });
    }
  }
  return elements.sort((a, b) => a.id.localeCompare(b.id));
}

function buildMatrix(elements, rule) {
  const n = elements.length;
  const texts = elements.map((e) =>
    e.files.map((f) => readFileSync(f, 'utf8')).join('\n')
  );

  // Голое имя ловится только в бэктиках: без них «engine» или «architect» встречаются
  // прозой и дают рёбра там, где ссылки нет.
  const patterns = elements.map((e) => {
    const canonical = new RegExp('`' + escapeRe(`${e.plugin}:${e.name}`) + '`');
    if (rule === 'canonical') return [canonical];
    return [canonical, new RegExp('`' + escapeRe(e.name) + '`')];
  });

  const dsm = Array.from({ length: n }, () => new Uint8Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (patterns[j].some((re) => re.test(texts[i]))) dsm[i][j] = 1;
    }
  }
  return dsm;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Диагональ = 1: элемент виден сам себе, иначе метрика не сходится с определением авторов.
function closure(dsm) {
  const n = dsm.length;
  const vis = dsm.map((row) => Uint8Array.from(row));
  for (let i = 0; i < n; i++) vis[i][i] = 1;
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      if (!vis[i][k]) continue;
      for (let j = 0; j < n; j++) if (vis[k][j]) vis[i][j] = 1;
    }
  }
  return vis;
}

// Цикл = сильно связная компонента: в ней нет направления, поэтому «ядро над модулями» в ней непроверяемо.
function largestCycle(vis, elements) {
  const n = vis.length;
  const seen = new Uint8Array(n);
  let best = [];
  for (let i = 0; i < n; i++) {
    if (seen[i]) continue;
    const comp = [];
    for (let j = 0; j < n; j++) {
      if (vis[i][j] && vis[j][i]) {
        comp.push(j);
        seen[j] = 1;
      }
    }
    if (comp.length > best.length) best = comp;
  }
  return best.map((i) => elements[i].id);
}

function main() {
  const args = process.argv.slice(2);
  const ruleArg = args.find((a) => a.startsWith('--rule='));
  const rule = ruleArg ? ruleArg.split('=')[1] : 'loose';
  if (!['canonical', 'loose'].includes(rule)) {
    console.error(`unknown --rule=${rule}; expected canonical|loose`);
    process.exit(2);
  }
  const topArg = args.find((a) => a.startsWith('--top='));
  const top = topArg ? Number(topArg.split('=')[1]) : 0;
  const asJson = args.includes('--json');

  const elements = collectElements();
  const n = elements.length;
  const vis = closure(buildMatrix(elements, rule));

  let reachable = 0;
  const fanout = [];
  for (let i = 0; i < n; i++) {
    let row = 0;
    for (let j = 0; j < n; j++) row += vis[i][j];
    reachable += row;
    fanout.push({ id: elements[i].id, reaches: row });
  }
  const cost = reachable / (n * n);
  const cycle = largestCycle(vis, elements);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          rule,
          elements: n,
          propagationCost: Number((cost * 100).toFixed(2)),
          largestCycle: cycle.length,
          largestCycleMembers: cycle,
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`Правило ребра:     ${rule}`);
  console.log(`Элементов:         ${n} (скиллы + агенты)`);
  console.log(`Propagation cost:  ${(cost * 100).toFixed(2)}%`);
  console.log(`Наибольший цикл:   ${cycle.length} из ${n}`);
  if (top) {
    console.log(`\nСамые расходящиеся (${top}):`);
    fanout
      .sort((a, b) => b.reaches - a.reaches)
      .slice(0, top)
      .forEach((f) => console.log(`  ${String(f.reaches).padStart(4)}  ${f.id}`));
  }
}

main();
