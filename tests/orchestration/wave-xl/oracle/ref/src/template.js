import { strftime } from './strftime.js';
import { wrap } from './wrap.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ESC[c]);

function syntaxError(message, offset) {
  const e = new SyntaxError(message);
  e.offset = offset;
  return e;
}

const FILTERS = {
  upper: [],
  lower: [],
  default: ['string'],
  date: ['string'],
  wrap: ['integer'],
  join: ['string'],
};

function parseFilters(rest, idx) {
  const bad = (m) => syntaxError(m, idx);
  const filters = [];
  let p = 0;
  const skip = () => { while (p < rest.length && /\s/.test(rest[p])) p++; };
  for (;;) {
    skip();
    const m = /^[^\s|]+/.exec(rest.slice(p));
    if (!m) throw bad('empty filter');
    p += m[0].length;
    if (!Object.hasOwn(FILTERS, m[0])) throw bad(`unknown filter ${m[0]}`);
    const args = [];
    for (;;) {
      skip();
      if (p >= rest.length || rest[p] === '|') break;
      if (rest[p] === '"') {
        let val = '';
        p++;
        for (;;) {
          if (p >= rest.length) throw bad('unterminated string');
          const c = rest[p++];
          if (c === '"') break;
          if (c === '\\') {
            const n = rest[p++];
            if (n !== '"' && n !== '\\') throw bad('bad escape');
            val += n;
          } else val += c;
        }
        if (p < rest.length && !/[\s|]/.test(rest[p])) throw bad('junk after string');
        args.push(val);
      } else {
        const t = /^[^\s|]+/.exec(rest.slice(p))[0];
        if (!/^-?\d+$/.test(t)) throw bad('bad argument');
        p += t.length;
        args.push(Number(t));
      }
    }
    const want = FILTERS[m[0]];
    if (args.length !== want.length) throw bad('wrong argument count');
    args.forEach((a, k) => {
      if ((want[k] === 'string') !== (typeof a === 'string')) throw bad('wrong argument type');
    });
    filters.push({ name: m[0], args });
    if (p >= rest.length) return filters;
    p++;
  }
}

function varNode(inner, raw, idx) {
  const bar = inner.indexOf('|');
  if (bar === -1) return { type: 'var', path: inner, raw, filters: [] };
  const path = inner.slice(0, bar).trim();
  if (path === '' || /\s/.test(path)) throw syntaxError('bad filter path', idx);
  return { type: 'var', path, raw, filters: parseFilters(inner.slice(bar + 1), idx) };
}

function applyFilter({ name, args }, v) {
  if (name === 'default') return v === undefined || v === null || v === '' ? args[0] : v;
  if (v === undefined || v === null) return v;
  switch (name) {
    case 'upper': return String(v).toUpperCase();
    case 'lower': return String(v).toLowerCase();
    case 'date': return strftime(typeof v === 'number' ? new Date(v) : v, args[0]);
    case 'wrap': return wrap(String(v), args[0]);
    default:
      if (!Array.isArray(v)) throw new TypeError('join over non-array');
      return v.join(args[0]);
  }
}

function parse(src) {
  const root = { type: 'root', cur: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  let i = 0;
  while (i < src.length) {
    const idx = src.indexOf('{{', i);
    if (idx === -1) {
      top().cur.push({ type: 'text', value: src.slice(i) });
      break;
    }
    if (idx > i) top().cur.push({ type: 'text', value: src.slice(i, idx) });
    const triple = src.startsWith('{{{', idx);
    const close = triple ? '}}}' : '}}';
    const open = triple ? 3 : 2;
    const end = src.indexOf(close, idx + open);
    if (end === -1) throw syntaxError('unclosed tag', idx);
    const inner = src.slice(idx + open, end).trim();
    i = end + close.length;
    const frame = top();
    if (triple) {
      frame.cur.push(varNode(inner, true, idx));
    } else if (inner.startsWith('#')) {
      if (inner.includes('|')) throw syntaxError('filters not allowed in blocks', idx);
      const m = /^#(if|each)\s+(\S+)$/.exec(inner);
      if (!m) throw syntaxError('bad block tag', idx);
      const node = { type: m[1], path: m[2], offset: idx, body: [], elseBody: [], inElse: false };
      node.cur = node.body;
      frame.cur.push(node);
      stack.push(node);
    } else if (inner.startsWith('/')) {
      const name = inner.slice(1).trim();
      if (frame.type === 'root' || frame.type !== name) throw syntaxError('unexpected closing tag', idx);
      stack.pop();
    } else if (inner === 'else') {
      if (frame.type !== 'if' || frame.inElse) throw syntaxError('unexpected else', idx);
      frame.inElse = true;
      frame.cur = frame.elseBody;
    } else {
      frame.cur.push(varNode(inner, false, idx));
    }
  }
  if (stack.length > 1) throw syntaxError('unclosed block', top().offset);
  return root;
}

const lookup = (segs, v) => {
  for (const s of segs) {
    if (v !== null && typeof v === 'object' && Object.hasOwn(v, s)) v = v[s];
    else return undefined;
  }
  return v;
};

function evaluate(path, scopes, data) {
  if (path === '@index') {
    return scopes.length ? scopes[scopes.length - 1].index : undefined;
  }
  const segs = path.split('.');
  if (segs[0] === 'this') {
    return lookup(segs.slice(1), scopes.length ? scopes[scopes.length - 1].item : data);
  }
  for (let k = scopes.length - 1; k >= 0; k--) {
    const r = lookup(segs, scopes[k].item);
    if (r !== undefined && r !== null) return r;
  }
  const r = lookup(segs, data);
  return r === null ? undefined : r;
}

function run(nodes, scopes, data) {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text') out += n.value;
    else if (n.type === 'var') {
      let v = evaluate(n.path, scopes, data);
      for (const f of n.filters) v = applyFilter(f, v);
      if (v !== undefined && v !== null) out += n.raw ? String(v) : escapeHtml(String(v));
    } else if (n.type === 'if') {
      const v = evaluate(n.path, scopes, data);
      const ok = Array.isArray(v) ? v.length > 0 : Boolean(v);
      out += run(ok ? n.body : n.elseBody, scopes, data);
    } else {
      const v = evaluate(n.path, scopes, data);
      if (v === undefined || v === null) continue;
      if (!Array.isArray(v)) throw new TypeError(`#each over non-array: ${n.path}`);
      v.forEach((item, index) => {
        out += run(n.body, [...scopes, { item, index }], data);
      });
    }
  }
  return out;
}

export function render(template, data) {
  const ast = parse(template);
  return run(ast.cur, [], data);
}
