#!/usr/bin/env node
// Эксперимент R: триаж на haiku. Для каждого из тринадцати кейсов набора optimize-for-llm
// строится описание задачи (без мин и без списка обязательного реза), бриф триажа берётся из
// references планировщика, модель оценивает оси двумя прогонами; категория выводится по таблице.
//
//   node triage.mjs run <каталог результатов> [--model haiku --effort medium --runs 2]
//   node triage.mjs describe                          напечатать описания задач
//
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const P = join(REPO, 'plugins/skills/dex-skill-orchestration-planner/skills/orchestration-planner/references');
const INPUTS = join(REPO, 'tests/optimize-for-llm/inputs');

const CASES = {
  'O-01': 'in-01-trap-skill.md', 'O-02': 'in-02-agent-phases.md', 'O-03': 'in-02-agent-phases.md', 'O-04': 'in-02-agent-phases.md',
  'O-05': 'in-03-description.md', 'O-06': 'in-04b-migration-agent.md', 'O-07': 'in-05-prose-order.md', 'O-08': 'in-06-dense.md',
  'O-09': 'in-07-code-comments.md', 'O-10': 'in-08b-release-track.md', 'O-11': 'in-09-conditional-skip.md',
  'O-12': 'in-10-diverged-copies.md', 'O-13': 'in-11-unfinished-unit.md',
};

function describe(id) {
  const t = readFileSync(join(INPUTS, CASES[id]), 'utf8');
  const lines = t.split('\n').length;
  const heads = (t.match(/^#{1,3} .+$/gm) || []).slice(0, 6).map((h) => h.replace(/^#+ /, '')).join('; ');
  const fm = /^---\n[\s\S]*?\n---/.exec(t)?.[0] ?? '';
  const kind = /^model:/m.test(fm) ? 'агент с фазами' : /^description:/m.test(fm) ? 'скилл' : 'документ';
  const extra = id === 'O-06' ? ' Рядом лежит PROJECT_RULES.md как контекст, он не правится.' : id === 'O-10' ? ' Рядом лежит references/channel-registry.md как дом нормы, он не правится.' : '';
  return `Прогнать скилл сжатия подачи на файле (${kind}, ${t.length} символов, ${lines} строк; заголовки: ${heads || 'нет'}). Нужно убрать воду, историю правок и пересказ кода, сохранив нормативные ограничения, кванторы и числа, и выдать отчёт по форме скилла. Результат проверяется скриптом по списку обязательных констант и чтением.${extra}`;
}

function brief(desc) {
  const briefs = readFileSync(join(P, 'briefs.md'), 'utf8');
  const tpl = briefs.match(/\*\*Триаж\*\*[\s\S]*?```markdown\n([\s\S]*?)```/)[1];
  const routing = readFileSync(join(P, 'routing.md'), 'utf8');
  const axes = routing.split('## Оси оценки трудности (0-2)')[1].split('`V` тир не двигает')[0].trim();
  return tpl.replace('<оси с якорями из routing.md>', axes).replace('<последние пять строк routing_log, либо «нет»>', 'нет').replace('<описание до 150 слов>', desc);
}

function category(a) {
  const S = a.A + a.B + a.N;
  if (S <= 1 && a.A === 0) return 'mechanical';
  if (S <= 3 || (S <= 1 && a.A >= 1)) return 'standard';
  if (S === 4 && a.A <= 1) return 'careful';
  return 'deep';
}

const [cmd, outArg] = process.argv.slice(2);
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };

if (cmd === 'describe') {
  for (const id of Object.keys(CASES)) console.log(`${id}: ${describe(id)}\n`);
} else if (cmd === 'run') {
  const out = resolve(outArg); mkdirSync(out, { recursive: true });
  const model = arg('model', 'haiku'), effort = arg('effort', 'medium'), runs = Number(arg('runs', '2'));
  const result = {};
  for (const id of Object.keys(CASES)) {
    const prompt = brief(describe(id));
    result[id] = { runs: [], cost: 0 };
    for (let r = 0; r < runs; r++) {
      const p = spawnSync('claude', ['-p', prompt, '--model', model, '--effort', effort, '--output-format', 'json', '--no-session-persistence', '--disallowedTools', 'Agent,Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch', '--max-budget-usd', '0.5'], { cwd: out, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      let j = null, parsed = null;
      try { j = JSON.parse(p.stdout); const m = String(j.result).match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; } catch { /* оставляем null */ }
      result[id].cost += j?.total_cost_usd ?? 0;
      result[id].runs.push(parsed);
    }
    const ok = result[id].runs.filter(Boolean);
    if (ok.length) {
      const merged = ['A', 'B', 'N', 'V'].reduce((acc, k) => ({ ...acc, [k]: Math.max(...ok.map((x) => x[k])) }), {});
      const disagree = ['A', 'B', 'N', 'V'].filter((k) => new Set(ok.map((x) => x[k])).size > 1);
      result[id].merged = merged; result[id].disagree = disagree; result[id].category = category(merged);
      result[id].conf = ok.map((x) => x.confidence);
    }
  }
  writeFileSync(join(out, 'triage.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(Object.fromEntries(Object.entries(result).map(([k, v]) => [k, { cat: v.category, axes: v.merged, disagree: v.disagree, conf: v.conf }])), null, 1));
} else { console.error('run | describe'); process.exit(2); }
