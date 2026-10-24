const NUM = /^-?\d+(\.\d+)?$/;
const ESC = { '"': '"', '\\': '\\', n: '\n', t: '\t' };

const fail = (n, msg) => new SyntaxError(`${msg} (line ${n})`);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
// defineProperty: ключ __proto__ должен стать данными, а не сменой прототипа
const put = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });

function typed(s) {
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (NUM.test(s)) return Number(s);
  return s;
}

function value(raw, n) {
  const s = raw.trim();
  if (s[0] !== '"') {
    const m = raw.search(/\s[;#]/);
    return typed((m < 0 ? raw : raw.slice(0, m)).trim());
  }
  let out = '';
  let i = 1;
  for (; i < s.length && s[i] !== '"'; i++) {
    if (s[i] !== '\\') { out += s[i]; continue; }
    const e = ESC[s[++i]];
    if (e === undefined) throw fail(n, i < s.length ? `unknown escape \\${s[i]}` : 'unclosed quote');
    out += e;
  }
  if (i >= s.length) throw fail(n, 'unclosed quote');
  const rest = s.slice(i + 1).trim();
  if (rest && !/^[;#]/.test(rest)) throw fail(n, 'unexpected text after quote');
  return out;
}

export function parseIni(text) {
  const root = {};
  let cur = root;
  const lines = String(text).split('\n');
  for (let idx = 0; idx < lines.length; idx++) {
    const n = idx + 1;
    const line = lines[idx].trim();
    if (!line || line[0] === ';' || line[0] === '#') continue;
    if (line[0] === '[') {
      if (line.at(-1) !== ']') throw fail(n, 'bad section header');
      const segs = line.slice(1, -1).split('.').map((s) => s.trim());
      if (segs.some((s) => !s)) throw fail(n, 'empty section name');
      cur = root;
      for (const seg of segs) {
        if (!Object.hasOwn(cur, seg)) put(cur, seg, {});
        else if (!isObj(cur[seg])) throw fail(n, `section name collides with key "${seg}"`);
        cur = cur[seg];
      }
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 0) throw fail(n, 'expected key = value');
    let key = line.slice(0, eq).trim();
    const isArr = key.endsWith('[]');
    if (isArr) key = key.slice(0, -2).trim();
    if (!key) throw fail(n, 'empty key');
    const v = value(line.slice(eq + 1), n);
    const has = Object.hasOwn(cur, key);
    if (isArr) {
      if (!has) put(cur, key, []);
      else if (!Array.isArray(cur[key])) throw fail(n, `key "${key}" is not an array`);
      cur[key].push(v);
    } else {
      if (has && (isObj(cur[key]) || Array.isArray(cur[key]))) throw fail(n, `key "${key}" is not a scalar`);
      put(cur, key, v);
    }
  }
  return root;
}

function scalar(v) {
  if (typeof v !== 'string') return String(v);
  const risky = v === '' || v !== v.trim() || /["\;#\n\t]/.test(v) || v === 'true' || v === 'false' || NUM.test(v);
  if (!risky) return v;
  return `"${v.replace(/["\\]/g, '\\$&').replace(/\n/g, '\\n').replace(/\t/g, '\\t')}"`;
}

export function stringifyIni(obj) {
  const blocks = [];
  const walk = (o, path) => {
    const own = Object.entries(o);
    const flat = own.filter(([, v]) => !isObj(v));
    const nested = own.filter(([, v]) => isObj(v));
    if (path.length === 0 ? flat.length : flat.length || !nested.length) {
      const lines = path.length ? [`[${path.join('.')}]`] : [];
      for (const [k, v] of flat) {
        if (Array.isArray(v)) for (const x of v) lines.push(`${k}[] = ${scalar(x)}`);
        else lines.push(`${k} = ${scalar(v)}`);
      }
      blocks.push(lines.join('\n'));
    }
    for (const [k, v] of nested) walk(v, [...path, k]);
  };
  walk(obj, []);
  return blocks.length ? blocks.join('\n\n') + '\n' : '';
}
