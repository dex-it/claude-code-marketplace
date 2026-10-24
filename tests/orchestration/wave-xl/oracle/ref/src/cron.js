const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const FIELDS = [
  { min: 0, max: 59 },
  { min: 0, max: 23 },
  { min: 1, max: 31 },
  { min: 1, max: 12, names: MONTHS, base: 1 },
  { min: 0, max: 7, names: DAYS, base: 0, starMax: 6 },
];

function value(token, spec) {
  if (/^\d+$/.test(token)) return Number(token);
  const i = spec.names ? spec.names.indexOf(token.toLowerCase()) : -1;
  if (i < 0) throw new SyntaxError(`bad value: ${token}`);
  return i + spec.base;
}

function inRange(n, spec) {
  if (n < spec.min || n > spec.max) throw new SyntaxError(`out of range: ${n}`);
  return n;
}

function parseField(text, spec) {
  const out = new Set();
  for (const part of text.split(',')) {
    const m = /^(\*|[^/-]+(?:-[^/-]+)?)(?:\/(\d+))?$/.exec(part);
    if (!m) throw new SyntaxError(`bad element: ${part}`);
    const [, body, stepText] = m;
    const step = stepText === undefined ? 1 : Number(stepText);
    if (step < 1) throw new SyntaxError('step must be >= 1');
    let lo;
    let hi;
    if (body === '*') {
      lo = spec.min;
      hi = spec.starMax ?? spec.max;
    } else {
      const [a, b] = body.split('-');
      lo = inRange(value(a, spec), spec);
      if (b === undefined) {
        if (stepText !== undefined) throw new SyntaxError('step on a single value');
        hi = lo;
      } else {
        hi = inRange(value(b, spec), spec);
        if (lo > hi) throw new SyntaxError('reversed range');
      }
    }
    for (let n = lo; n <= hi; n += step) out.add(spec === FIELDS[4] && n === 7 ? 0 : n);
  }
  return [...out].sort((x, y) => x - y);
}

function parseFull(expr) {
  if (typeof expr !== 'string') throw new SyntaxError('expression must be a string');
  const texts = expr.trim().split(/\s+/);
  if (texts.length !== 5) throw new SyntaxError('expected 5 fields');
  const [minute, hour, dayOfMonth, month, dayOfWeek] = texts.map((t, i) => parseField(t, FIELDS[i]));
  return {
    cron: { minute, hour, dayOfMonth, month, dayOfWeek },
    domRestricted: texts[2] !== '*',
    dowRestricted: texts[4] !== '*',
  };
}

export function parseCron(expr) {
  return parseFull(expr).cron;
}

export function nextRun(expr, from) {
  const { cron, domRestricted, dowRestricted } = parseFull(expr);
  const start = Math.floor(from.getTime() / 60000) * 60000 + 60000;
  const limit = new Date(start);
  limit.setUTCFullYear(limit.getUTCFullYear() + 5);
  const day = new Date(start);
  day.setUTCHours(0, 0, 0, 0);
  for (; day <= limit; day.setUTCDate(day.getUTCDate() + 1)) {
    if (!cron.month.includes(day.getUTCMonth() + 1)) continue;
    const domOk = cron.dayOfMonth.includes(day.getUTCDate());
    const dowOk = cron.dayOfWeek.includes(day.getUTCDay());
    const ok = domRestricted && dowRestricted ? domOk || dowOk : domOk && dowOk;
    if (!ok) continue;
    for (const h of cron.hour) {
      for (const mi of cron.minute) {
        const t = day.getTime() + h * 3600000 + mi * 60000;
        if (t >= start) return new Date(t);
      }
    }
  }
  throw new RangeError('no matching time within 5 years');
}
