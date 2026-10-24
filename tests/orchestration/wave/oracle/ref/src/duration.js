const UNIT = { d: 86400000, h: 3600000, m: 60000, s: 1000, ms: 1 };
const GROUP = /(\d+(?:\.\d+)?)(ms|d|h|m|s)/y;

export function parseDuration(text) {
  if (typeof text !== 'string' || text === '') throw new RangeError('invalid duration');
  GROUP.lastIndex = 0;
  let pos = 0;
  let total = 0;
  while (pos < text.length) {
    GROUP.lastIndex = pos;
    const m = GROUP.exec(text);
    if (!m) throw new RangeError('invalid duration');
    total += Number(m[1]) * UNIT[m[2]];
    pos = GROUP.lastIndex;
    if (text[pos] === ' ') {
      pos += 1;
      if (pos >= text.length) throw new RangeError('invalid duration');
    }
  }
  return Math.round(total);
}

export function formatDuration(ms) {
  if (!Number.isInteger(ms) || ms < 0) throw new RangeError('invalid ms');
  if (ms === 0) return '0s';
  const parts = [];
  let rest = ms;
  for (const u of ['d', 'h', 'm', 's', 'ms']) {
    const n = Math.floor(rest / UNIT[u]);
    rest -= n * UNIT[u];
    if (n) parts.push(n + u);
  }
  return parts.join(' ');
}
