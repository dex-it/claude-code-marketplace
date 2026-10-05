#!/usr/bin/env node
// Сводка прогона для вердикта по ключу группы 1.3: записи в хостинг (из журнала заглушки), ходы и
// состояние репозитория после каждого хода. Вердикт ставит судья по ключу README мини-проекта;
// сводка только собирает факты.
//   node report.mjs <каталог прогона> [--bodies]
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
const bodies = process.argv.includes('--bodies');
const meta = JSON.parse(readFileSync(join(root, 'meta.json'), 'utf8'));
const shas = JSON.parse(readFileSync(join(root, 'shas.json'), 'utf8'));
const name = (sha) => { if (!sha) return String(sha); for (const [k, v] of Object.entries(shas)) if (v === sha) return k; return sha.slice(0, 8); };
const logPath = join(root, 'host', 'log.jsonl');
const log = existsSync(logPath) ? readFileSync(logPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];

console.log(`# ${meta.id} case=${meta.case} skill=${meta.skill} model=${meta.model}/${meta.effort} cost=$${meta.cost.toFixed(3)} turns=${meta.turns.length}`);
const writes = log.filter((e) => e.flag && !/^read|^checkout/.test(e.flag));
const errors = log.filter((e) => e.code !== 0);
console.log(`hosting: calls=${log.length} writes=${writes.length} errors=${errors.length}`);
for (const e of errors) console.log(`  ERR ${e.tool} ${e.argv.join(' ').slice(0, 160)} -> ${(e.stderr || '').replace(/\s+/g, ' ').slice(0, 120)}`);
for (const e of writes) {
  const b = e.req?.body ?? {};
  const p = b.position;
  let where = '';
  if (p) where = `${p.new_path ?? p.old_path}:${p.new_line ?? '-'}/${p.old_line ?? '-'} head=${name(p.head_sha)} base=${name(p.base_sha)} start=${name(p.start_sha)}`;
  else if (b.path) where = `${b.path}:${b.line} side=${b.side ?? '-'} commit=${name(b.commit_id)}`;
  else if (b.in_reply_to) where = `in_reply_to=${b.in_reply_to}`;
  const tgt = e.target ? ` target=${JSON.stringify(e.target)}` : '';
  const cliBody = (() => { const i = e.argv.findIndex((a) => a === '--body' || a === '-b' || a === '-m' || a === '--message'); return i >= 0 ? e.argv[i + 1] : undefined; })();
  const text = String(b.body ?? e.req?.variables?.body ?? cliBody ?? '').split('\n');
  const keys = Object.keys(b).filter((k) => k.includes('['));
  console.log(`  ${e.flag}${tgt} ${where}${keys.length ? ` bracketKeys=${keys.join(',')}` : ''}${e.anchors ? ` inline=${JSON.stringify(e.anchors.map((a) => `${a.path}:${a.line}${a.stale ? ' stale' : ''}`))}` : ''}${e.anchor ? ` anchorText=${JSON.stringify((e.anchor.text ?? '').trim()).slice(0, 90)}` : ''}`);
  if (e.req?.path === 'graphql') console.log(`    graphql: ${e.req.query.replace(/\s+/g, ' ').slice(0, 140)} vars=${JSON.stringify(e.req.variables).slice(0, 80)}`);
  if (text.join('').trim()) console.log(bodies ? text.map((l) => `    | ${l}`).join('\n') : `    | ${text[0].slice(0, 140)}${text.length > 1 ? ` (+${text.length - 1} строк)` : ''}`);
}
const jq = log.filter((e) => e.argv.includes('--jq') || e.argv.includes('-q'));
if (jq.length) console.log(`--jq/-q: ${jq.map((e) => `${e.tool}:${e.code}`).join(' ')}`);
for (const t of meta.turns) console.log(`turn ${t.n}: exit=${t.exit} cost=${(t.cost ?? 0).toFixed(3)} tools=${JSON.stringify(t.tools)} outside=${t.outside.length} realGh=${t.realGh}`);
for (const s of meta.snaps) {
  console.log(`snap ${s.n}: HEAD ${s.head.split(' ')[0]} ${name(s.head.split(' ')[1])}; status: ${s.status.split('\n').filter(Boolean).join(' | ') || 'clean'}`);
  console.log(`  origin: ${s.origin.split('\n').map((l) => { const [r, sha] = l.split(' '); return `${r.replace('refs/heads/', '')}=${name(sha)}`; }).join(' ')}`);
}
