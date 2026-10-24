const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December'];
const DAY_MS = 86400000;

function check(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError('invalid date');
}

function startOfYear(year) {
  const d = new Date(0);
  d.setUTCFullYear(year, 0, 1);
  return d;
}

function dayOfYear(date) {
  const d = new Date(date.getTime());
  d.setUTCHours(0, 0, 0, 0);
  return Math.round((d - startOfYear(d.getUTCFullYear())) / DAY_MS) + 1;
}

export function isoWeek(date) {
  check(date);
  const thu = new Date(date.getTime());
  thu.setUTCHours(0, 0, 0, 0);
  thu.setUTCDate(thu.getUTCDate() - ((thu.getUTCDay() + 6) % 7) + 3);
  const year = thu.getUTCFullYear();
  return { year, week: Math.floor((thu - startOfYear(year)) / DAY_MS / 7) + 1 };
}

const NUMERIC = {
  Y: [(d) => d.getUTCFullYear(), 4],
  y: [(d) => d.getUTCFullYear() % 100, 2],
  m: [(d) => d.getUTCMonth() + 1, 2],
  d: [(d) => d.getUTCDate(), 2],
  e: [(d) => d.getUTCDate(), 2, ' '],
  H: [(d) => d.getUTCHours(), 2],
  I: [(d) => d.getUTCHours() % 12 || 12, 2],
  M: [(d) => d.getUTCMinutes(), 2],
  S: [(d) => d.getUTCSeconds(), 2],
  L: [(d) => d.getUTCMilliseconds(), 3],
  j: [dayOfYear, 3],
  u: [(d) => d.getUTCDay() || 7, 1],
  w: [(d) => d.getUTCDay(), 1],
  G: [(d) => isoWeek(d).year, 4],
  V: [(d) => isoWeek(d).week, 2],
  s: [(d) => Math.floor(d.getTime() / 1000), 1],
};

const TEXT = {
  a: (d) => DAYS[d.getUTCDay()].slice(0, 3),
  A: (d) => DAYS[d.getUTCDay()],
  b: (d) => MONTHS[d.getUTCMonth()].slice(0, 3),
  B: (d) => MONTHS[d.getUTCMonth()],
  p: (d) => (d.getUTCHours() < 12 ? 'AM' : 'PM'),
  '%': () => '%',
};

export function strftime(date, format) {
  check(date);
  if (typeof format !== 'string') throw new TypeError('format must be a string');
  let out = '';
  for (let i = 0; i < format.length; i++) {
    const ch = format[i];
    if (ch !== '%') { out += ch; continue; }
    let c = format[++i];
    let flag = null;
    if (c === '-' || c === '_' || c === '0') {
      flag = c;
      c = format[++i];
    }
    if (c === undefined) throw new RangeError('format ends with %');
    const num = Object.hasOwn(NUMERIC, c) && NUMERIC[c];
    if (num) {
      const s = String(num[0](date));
      const fill = flag === '_' ? ' ' : flag === '0' ? '0' : (num[2] ?? '0');
      out += flag === '-' ? s : s.padStart(num[1], fill);
    } else if (Object.hasOwn(TEXT, c) && flag === null) {
      out += TEXT[c](date);
    } else {
      throw new RangeError(`bad directive %${flag ?? ''}${c}`);
    }
  }
  return out;
}
