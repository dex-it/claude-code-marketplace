#!/usr/bin/env node
/**
 * Исполняемая оценка E4: код прогона (все *.cs из ~/.cache/research/runs/<id>/work) собирается со
 * стендом grade/e4-harness на EF Core 8.0.8 + Npgsql 8.0.4 и выполняется на Postgres 16 в docker.
 * Код прогона не правится. Выход - results/grades/<id>.e4.json со строками ключа E4.
 *
 *   node grade/e4.mjs <id> [<id> ...]
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESEARCH = resolve(HERE, '../..');
const RUNS = join(homedir(), '.cache/research/runs');
const WORK = join(homedir(), '.cache/research/e4');
const OUT = join(RESEARCH, 'results/grades');
const PG = 'research-pg';

function ensurePostgres() {
  const up = spawnSync('docker', ['ps', '--filter', `name=${PG}`, '--format', '{{.Names}}']).stdout.toString().trim();
  if (up === PG) return;
  execFileSync('docker', ['run', '-d', '--rm', '--name', PG, '-e', 'POSTGRES_PASSWORD=pw', '-p', '55432:5432', 'postgres:16'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    if (spawnSync('docker', ['exec', PG, 'pg_isready', '-U', 'postgres']).status === 0) return;
    spawnSync('sleep', ['1']);
  }
  throw new Error('Postgres не поднялся');
}

function csFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === '.git') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...csFiles(p));
    else if (name.endsWith('.cs')) out.push(p);
  }
  return out;
}

function grade(id) {
  const src = join(RUNS, id, 'work');
  if (!existsSync(src)) throw new Error(`нет ${src}`);
  const dir = join(WORK, id);
  rmSync(dir, { recursive: true, force: true });
  cpSync(join(HERE, 'e4-harness'), dir, { recursive: true });
  mkdirSync(join(dir, 'run'));
  // Плоская раскладка: имена файлов с путём через «__», чтобы одноимённые файлы не затёрлись.
  for (const f of csFiles(src)) cpSync(f, join(dir, 'run', relative(src, f).replaceAll('/', '__')));

  const build = spawnSync('dotnet', ['build', '-nologo', '-v', 'q', '-c', 'Release'], { cwd: dir, encoding: 'utf8' });
  const res = { id, case: 'E4', build: build.status === 0 ? 'ok' : 'fail', log: '', items: {} };
  if (build.status !== 0) {
    res.log = (build.stdout + build.stderr).split('\n').filter((l) => / error /.test(l)).slice(0, 8).join('\n');
    for (const k of ['E4-ts', 'E4-cascade', 'E4-clear']) res.items[k] = { verdict: 'fail', basis: 'не собирается' };
    return res;
  }
  ensurePostgres();
  const run = spawnSync('dotnet', ['run', '--no-build', '-c', 'Release', '--', `e4_${id}`], { cwd: dir, encoding: 'utf8', timeout: 180000 });
  const log = (run.stdout + run.stderr).trim();
  res.log = log.split('\n').slice(0, 40).join('\n');

  const ddl = log.split('\n').filter((l) => l.startsWith('DDL'));
  const fk = (t) => ddl.filter((l) => l.includes(`"FK_${t}_Orders_`) || (l.includes(`"${t}"`) && l.includes('REFERENCES "Orders"')));
  const writeOk = /^WRITE ok/m.test(log);
  const read = log.match(/^READ Kind=(\w+) driftMs=([\d.]+) equalsWritten=(\w+)/m);
  const clear = log.match(/^CLEAR ok, items left in DB = (\d+)/m);
  const clearFail = log.match(/^CLEAR FAIL (.*)$/m);

  res.items['E4-ts'] = writeOk && read && read[3] === 'True'
    ? { verdict: 'pass', basis: `WRITE ok; READ Kind=${read[1]} driftMs=${read[2]}` }
    : { verdict: 'fail', basis: writeOk ? `READ ${read ? read.slice(1).join(' ') : 'нет'}` : (log.match(/^WRITE FAIL.*$/m)?.[0] ?? 'нет строки WRITE') };

  const cascade = ddl.filter((l) => /ON DELETE CASCADE/i.test(l));
  res.items['E4-cascade'] = ddl.length >= 2 && cascade.length === 0
    ? { verdict: 'pass', basis: `FK без каскада: ${ddl.length} строк DDL` }
    : { verdict: 'fail', basis: ddl.length < 2 ? `строк DDL ${ddl.length}` : `CASCADE: ${cascade.join(' | ')}` };

  res.items['E4-clear'] = clear && clear[1] === '0'
    ? { verdict: 'pass', basis: 'CLEAR ok, позиций 0' }
    : { verdict: 'fail', basis: clear ? `осталось позиций ${clear[1]}` : (clearFail?.[0] ?? 'нет строки CLEAR (запись не прошла)') };
  res.fkLines = { items: fk('OrderItem').length + fk('Items').length, payments: fk('Payment').length + fk('Payments').length };
  return res;
}

mkdirSync(OUT, { recursive: true });
for (const id of process.argv.slice(2)) {
  const r = grade(id);
  writeFileSync(join(OUT, `${id}.e4.json`), JSON.stringify(r, null, 2));
  console.log(`${id} build=${r.build} ${Object.entries(r.items).map(([k, v]) => `${k}=${v.verdict}`).join(' ')}`);
}
