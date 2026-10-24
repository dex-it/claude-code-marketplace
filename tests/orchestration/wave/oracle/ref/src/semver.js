const RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export function parse(text) {
  const m = RE.exec(String(text));
  if (!m) throw new TypeError('invalid version: ' + text);
  return { major: +m[1], minor: +m[2], patch: +m[3], prerelease: m[4] ? m[4].split('.') : [] };
}

function cmpId(a, b) {
  const an = /^\d+$/.test(a), bn = /^\d+$/.test(b);
  if (an && bn) return Math.sign(Number(a) - Number(b));
  if (an) return -1;
  if (bn) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compare(a, b) {
  const x = typeof a === 'string' ? parse(a) : a, y = typeof b === 'string' ? parse(b) : b;
  for (const k of ['major', 'minor', 'patch']) if (x[k] !== y[k]) return x[k] < y[k] ? -1 : 1;
  const p = x.prerelease, q = y.prerelease;
  if (!p.length && !q.length) return 0;
  if (!p.length) return 1;
  if (!q.length) return -1;
  for (let i = 0; i < Math.max(p.length, q.length); i += 1) {
    if (p[i] === undefined) return -1;
    if (q[i] === undefined) return 1;
    const c = cmpId(p[i], q[i]);
    if (c) return c;
  }
  return 0;
}

function comparators(tok) {
  let m;
  if (tok === '*' || tok === 'x' || tok === 'X') return [['>=', '0.0.0']];
  if ((m = /^\^(.+)$/.exec(tok))) {
    const v = parse(m[1]);
    const hi = v.major > 0 ? `${v.major + 1}.0.0` : v.minor > 0 ? `0.${v.minor + 1}.0` : `0.0.${v.patch + 1}`;
    return [['>=', m[1]], ['<', hi]];
  }
  if ((m = /^~(.+)$/.exec(tok))) {
    const v = parse(m[1]);
    return [['>=', m[1]], ['<', `${v.major}.${v.minor + 1}.0`]];
  }
  if ((m = /^(\d+)\.x$/.exec(tok))) return [['>=', `${m[1]}.0.0`], ['<', `${+m[1] + 1}.0.0`]];
  if ((m = /^(\d+)\.(\d+)\.x$/.exec(tok))) return [['>=', `${m[1]}.${m[2]}.0`], ['<', `${m[1]}.${+m[2] + 1}.0`]];
  if ((m = /^(>=|<=|>|<|=)?(.+)$/.exec(tok))) return [[m[1] || '=', m[2]]];
  throw new TypeError('bad range');
}

export function satisfies(version, range) {
  const v = parse(version);
  return String(range).split('||').some((set) => {
    const toks = set.trim().split(/\s+/).filter(Boolean);
    const comps = toks.flatMap(comparators);
    const ok = comps.every(([op, ver]) => {
      const c = compare(v, ver);
      return { '>=': c >= 0, '>': c > 0, '<=': c <= 0, '<': c < 0, '=': c === 0 }[op];
    });
    if (!ok) return false;
    if (!v.prerelease.length) return true;
    return comps.some(([, ver]) => {
      const w = parse(ver);
      return w.prerelease.length && w.major === v.major && w.minor === v.minor && w.patch === v.patch;
    });
  });
}
