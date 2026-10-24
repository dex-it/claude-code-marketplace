#!/usr/bin/env node
/**
 * Судья по ключу: `claude -p` (opus, effort high, без инструментов) получает строки ключа кейса,
 * diff.patch и answer.md прогона и возвращает вердикт по каждой строке с цитатой-основанием.
 * Условие прогона судье не видно: упоминания файла скилла и имён скиллов скрыты. Строки, которые
 * судит исполнение (exec E4), судья не получает.
 *
 *   node grade/judge.mjs <id> [<id> ...] [--parallel 2]
 * Выход: results/grades/<id>.judge.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESEARCH = resolve(HERE, '../..');
const OUT = join(RESEARCH, 'results/grades');
const KEYS = yaml.load(readFileSync(join(HERE, '../keys.yaml'), 'utf8'));
const argv = process.argv.slice(2);
const pi = argv.indexOf('--parallel');
const PARALLEL = Math.min(2, pi >= 0 ? Number(argv[pi + 1]) : 2);
const ids = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--parallel');
const EXEC_ITEMS = new Set(['E4-ts', 'E4-cascade', 'E4-clear']);
const MAX_DIFF = 120000;

// Упоминания подачи скилла: путь rules/SKILL.md, имена скиллов, «правила/ловушки ... принятые в команде».
const REDACT = [
  /\/[^\s`'")]*\/rules\/SKILL\.md/g, /SKILL\.md/g,
  /dotnet-ef-core|dotnet-linq-optimization|dotnet-di\b|dotnet-config-hygiene|fact-verification/g,
  /(правил[а-я]*|ловушк[а-я]*|чек-лист[а-я]*|дисциплин[а-я]*)\s+(EF Core|LINQ|DI|конфигурации)?\s*(в\s+\.NET\s+)?,?\s*принят[а-я]*\s+в\s+команде/gi,
];
const redact = (s) => REDACT.reduce((acc, re) => acc.replace(re, '[скрыто]'), s);

function rubric(caseId) {
  const k = KEYS[caseId];
  const lines = [];
  for (const it of k.items) {
    if (EXEC_ITEMS.has(it.id)) continue;
    if (it.kind === 'unit') {
      lines.push(`- ${it.id} [unit]: PASS если: ${it.pass}. FAIL если: ${it.fail}.${it.disputed ? ` DISPUTED если: ${it.disputed}.` : ''}`);
    } else if (it.kind === 'harm' || it.kind === 'mine') {
      lines.push(`- ${it.id} [${it.kind}]: YES если выход делает это: ${it.what}. Иначе NO.`);
    } else {
      lines.push(`- ${it.id} [${it.kind}]: FOUND если выход называет этот дефект как проблему (находка ревью или исправление в коде): ${it.what}. Иначе MISSED.`);
    }
  }
  return lines.join('\n');
}

function prompt(id, caseId) {
  const dir = join(RESEARCH, 'runs', id);
  const answer = redact(existsSync(join(dir, 'answer.md')) ? readFileSync(join(dir, 'answer.md'), 'utf8') : '');
  let diff = redact(existsSync(join(dir, 'diff.patch')) ? readFileSync(join(dir, 'diff.patch'), 'utf8') : '');
  if (diff.length > MAX_DIFF) diff = diff.slice(0, MAX_DIFF) + '\n[diff обрезан]';
  const kind = JSON.parse(readFileSync(join(HERE, '../cases', `${caseId}.json`), 'utf8')).kind;
  return `Ты оцениваешь выход исполнителя по ключу. Исполнитель получил ${kind === 'code' ? 'поручение написать код' : 'поручение сделать ревью MR'}; его выход - diff рабочего каталога (код и файл _answer.md) и финальный ответ.

Правила оценки:
- Судишь только по выходу ниже. Код судится по diff, не по пересказу в ответе: если ответ утверждает одно, а код делает другое, верен код.
- Правило, названное, но не применённое в коде или находке, - FAIL.
- Находка засчитывается (FOUND), если она называет тот же дефект по существу, даже другими словами и с другой severity.
- Ложная находка (harm YES) - находка или правка, которая объявляет правильный код дефектом или меняет его по этой причине.
- Если строка ключа к выходу неприменима (кода для неё нет), ставь FAIL для unit, NO для harm/mine, MISSED для coverage/skill и пиши причину.

Ключ кейса ${caseId}:
${rubric(caseId)}

Ответь ТОЛЬКО JSON-объектом без markdown:
{"items": {"<id строки>": {"verdict": "PASS|FAIL|DISPUTED|YES|NO|FOUND|MISSED", "quote": "короткая дословная цитата из выхода или 'нет'", "why": "одна фраза"}}}

=== ФИНАЛЬНЫЙ ОТВЕТ ИСПОЛНИТЕЛЯ ===
${answer}

=== DIFF ===
${diff}
`;
}

function judge(id) {
  const caseId = readFileSync(join(RESEARCH, 'runs', id, 'case.txt'), 'utf8').trim();
  const p = prompt(id, caseId);
  const args = ['-p', '--output-format', 'json', '--model', 'claude-opus-5-5', '--effort', 'high',
    '--tools', '', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence', '--max-turns', '2'];
  return new Promise((done) => {
    const child = spawn('claude', args, { cwd: '/', stdio: ['pipe', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.stdin.end(p);
    child.on('close', (code) => {
      let items = null; let raw = ''; let cost = null;
      try {
        const r = JSON.parse(out);
        cost = { usd: r.total_cost_usd, durationMs: r.duration_ms, usage: r.usage };
        raw = r.result ?? '';
        items = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)).items;
      } catch { /* разбор не удался - ниже в файле код выхода и сырой текст */ }
      const res = { id, case: caseId, judge: 'claude-opus-5-5/high', exitCode: code, cost, items, raw: items ? undefined : (raw || out).slice(0, 4000), stderr: err.slice(-1000) };
      writeFileSync(join(OUT, `${id}.judge.json`), JSON.stringify(res, null, 2));
      console.log(`${id} ${caseId} ${items ? Object.keys(items).length + ' строк' : 'РАЗБОР НЕ УДАЛСЯ'}`);
      done();
    });
  });
}

mkdirSync(OUT, { recursive: true });
const queue = [...ids];
await Promise.all(Array.from({ length: PARALLEL }, async () => { while (queue.length) await judge(queue.shift()); }));
