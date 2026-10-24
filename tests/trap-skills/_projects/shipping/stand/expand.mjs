// Данные стенда кейса (cases/<кейс>/stand.json) -> итоговый STAND_DIR/stand.json: подстановка
// {{ref:ИМЯ}} и {{sha12:ИМЯ}} по refs, ряды метрик и повторяющиеся строки логов по описанию.
// Итог - статичный JSON, standctl ничего не генерирует. Формат - README мини-проекта, «Имитация стенда».
//   node stand/expand.mjs <case-stand.json> <refs.json> > stand.json
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');

// FNV-1a: детерминированный «шум» и x-request-id без генератора случайных чисел.
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}
const noise = (key, amp) => (amp ? ((hash(key) / 0xffffffff) * 2 - 1) * amp : 0);

// Кусочно-линейная функция по точкам [[ISO, значение], ...]; вне точек - крайние значения.
function linear(points) {
  const pts = points.map(([t, v]) => [Date.parse(t), v]);
  return (ms) => {
    if (ms <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const [t1, v1] = pts[i];
      if (ms <= t1) { const [t0, v0] = pts[i - 1]; return t1 === t0 ? v1 : v0 + ((v1 - v0) * (ms - t0)) / (t1 - t0); }
    }
    return pts[pts.length - 1][1];
  };
}

export function substitute(value, refs) {
  if (typeof value === 'string') {
    return value.replace(/\{\{(ref|sha12):([A-Za-z0-9_]+)\}\}/g, (_, kind, name) => {
      const sha = refs[name];
      if (!sha) throw new Error(`stand: нет ref ${name} в refs.json`);
      return kind === 'ref' ? sha : sha.slice(0, 12);
    });
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, refs));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, refs)]));
  return value;
}

// metrics: {svc: {name: {unit, step, from, to, points, jitter, round, agg}}} -> {svc: {name: {unit, step, series}}}
function expandMetrics(metrics) {
  const out = {};
  for (const [svc, byName] of Object.entries(metrics)) {
    out[svc] = {};
    for (const [name, m] of Object.entries(byName)) {
      if (m.series) { out[svc][name] = m; continue; }
      const f = linear(m.points), step = (m.step ?? 300) * 1000, digits = m.round ?? 0;
      const series = [];
      for (let t = Date.parse(m.from); t <= Date.parse(m.to); t += step) {
        // agg: last - значение в точке; max - максимум за интервал (t - step, t] с шагом 10 с.
        let raw = f(t);
        if (m.agg === 'max') for (let s = t - step + 10_000; s < t; s += 10_000) raw = Math.max(raw, f(s));
        const v = Math.max(0, raw + noise(`${svc}/${name}/${t}`, m.jitter ?? 0));
        series.push([iso(t), Number(v.toFixed(digits))]);
      }
      out[svc][name] = { unit: m.unit, step: m.step ?? 300, series };
    }
  }
  return out;
}

// logs: строки {at, svc, level, msg} как есть; {at: [ISO, ...], ...} - по строке на время;
// {repeat: {from, to, every}, ...} - каждые every секунд. В msg: {rid} - x-request-id из хэша,
// {n} - номер повтора, {имя} - значение ряда values.имя (точки, как у метрик) с шумом values.jitter.
function expandLogs(logs) {
  const out = [];
  for (const e of logs) {
    let times;
    if (e.repeat) {
      times = [];
      for (let t = Date.parse(e.repeat.from); t <= Date.parse(e.repeat.to); t += e.repeat.every * 1000) times.push(t);
    } else times = (Array.isArray(e.at) ? e.at : [e.at]).map((t) => Date.parse(t));
    const fns = Object.fromEntries(Object.entries(e.values ?? {}).filter(([k]) => k !== 'jitter').map(([k, pts]) => [k, linear(pts)]));
    times.forEach((t, n) => {
      const msg = e.msg.replace(/\{(\w+)\}/g, (m, k) => {
        if (k === 'rid') return (e.ridPrefix ?? '') + hash(`${e.svc}/${e.msg}/${t}`).toString(16).padStart(8, '0');
        if (k === 'n') return String(n + 1);
        if (fns[k]) return String(Math.max(1, Math.round(fns[k](t) + noise(`${k}/${t}`, e.values.jitter ?? 0))));
        return m;
      });
      out.push({ at: iso(t), svc: e.svc, level: e.level ?? 'INFO', msg });
    });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export function expandStand(raw, refs) {
  const st = substitute(raw, refs);
  st.logs = expandLogs(st.logs ?? []);
  st.metrics = expandMetrics(st.metrics ?? {});
  for (const [name, svc] of Object.entries(st.services)) {
    if (svc.sha && !svc.image) svc.image = `${st.registry}/${name}:${svc.sha.slice(0, 12)}`;
    for (const h of svc.history ?? []) if (h.sha && !h.image) h.image = `${st.registry}/${name}:${h.sha.slice(0, 12)}`;
  }
  return st;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [caseFile, refsFile] = process.argv.slice(2);
  const st = expandStand(JSON.parse(readFileSync(caseFile, 'utf8')), JSON.parse(readFileSync(refsFile, 'utf8')));
  process.stdout.write(JSON.stringify(st, null, 1) + '\n');
}
