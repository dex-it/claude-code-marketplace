#!/usr/bin/env node
/**
 * План стадии: декартово произведение ячеек x n повторов, случайный id на прогон, порядок перемешан
 * (дрейф API во времени не ложится на одну форму). План - это таблица «id -> условие», поэтому он
 * пишется вне репозитория: ~/.cache/research/sealed/plan-<stage>.csv. В репозиторий она попадает
 * после оценки стадии (results/plan-<stage>.csv).
 *
 * Спецификация стадии - JSON:
 *   { "stage": "A", "n": 4, "cells": [ { "cases": [...], "forms": [...], "models": [...],
 *     "effort": {"sonnet": "high"}, "search": ["none"], "delivery": ["path"] } ] }
 *
 *   node plan.mjs stages/A.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';

const SEALED = join(homedir(), '.cache/research/sealed');
const spec = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'));
const out = join(SEALED, `plan-${spec.stage}.csv`);
if (existsSync(out) && !process.argv.includes('--force')) {
  console.error(`${out} уже есть; --force перезапишет`);
  process.exit(2);
}

const used = new Set();
const rid = () => { let id; do { id = randomBytes(3).toString('hex'); } while (used.has(id)); used.add(id); return id; };

const rows = [];
for (const c of spec.cells) {
  for (const kase of c.cases) for (const form of c.forms) for (const model of c.models)
    for (const search of c.search ?? ['none']) for (const delivery of c.delivery ?? ['path'])
      for (let i = 0; i < (c.n ?? spec.n); i++) {
        // F0 без скилла не различается подачей: вторую подачу для F0 не плодим.
        if (form === 'F0' && delivery !== (c.delivery ?? ['path'])[0]) continue;
        rows.push({ id: rid(), case: kase, form, model, effort: c.effort[model], search, delivery, stage: spec.stage });
      }
}
for (let i = rows.length - 1; i > 0; i--) {
  const j = randomBytes(4).readUInt32BE() % (i + 1);
  [rows[i], rows[j]] = [rows[j], rows[i]];
}
const cols = ['id', 'case', 'form', 'model', 'effort', 'search', 'delivery', 'stage'];
mkdirSync(SEALED, { recursive: true });
writeFileSync(out, [cols.join(','), ...rows.map((r) => cols.map((k) => r[k]).join(','))].join('\n') + '\n');
console.log(`${rows.length} прогонов -> ${out}`);
