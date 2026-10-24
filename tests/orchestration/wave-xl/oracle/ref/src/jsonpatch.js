const INDEX = /^(0|[1-9][0-9]*)$/;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const clone = (v) => {
  if (Array.isArray(v)) return v.map(clone);
  if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)]));
  return v;
};

const parse = (pointer) => {
  if (typeof pointer !== 'string') throw new TypeError('pointer must be a string');
  if (pointer === '') return [];
  if (pointer[0] !== '/') throw new SyntaxError('pointer must start with "/"');
  return pointer.split('/').slice(1).map((t) => {
    if (/~(?![01])/.test(t)) throw new SyntaxError('bad escape');
    return t.replace(/~1/g, '/').replace(/~0/g, '~');
  });
};

const index = (arr, token, forAdd) => {
  if (token === '-') {
    if (forAdd) return arr.length;
    throw new RangeError('"-" is not addressable');
  }
  if (!INDEX.test(token)) throw new SyntaxError(`bad array index ${token}`);
  const i = Number(token);
  if (forAdd ? i > arr.length : i >= arr.length) throw new RangeError('index out of range');
  return i;
};

const walk = (doc, tokens) => {
  let cur = doc;
  for (const t of tokens) {
    if (Array.isArray(cur)) cur = cur[index(cur, t, false)];
    else if (isObj(cur) && has(cur, t)) cur = cur[t];
    else throw new RangeError('path not found');
  }
  return cur;
};

const setKey = (o, k, value) => {
  Object.defineProperty(o, k, { value, writable: true, enumerable: true, configurable: true });
};

const add = (doc, tokens, value) => {
  if (tokens.length === 0) return value;
  const parent = walk(doc, tokens.slice(0, -1));
  const last = tokens[tokens.length - 1];
  if (Array.isArray(parent)) parent.splice(index(parent, last, true), 0, value);
  else if (isObj(parent)) setKey(parent, last, value);
  else throw new RangeError('parent is not a container');
  return doc;
};

const target = (doc, tokens) => {
  if (tokens.length === 0) throw new RangeError('root has no parent');
  const parent = walk(doc, tokens.slice(0, -1));
  const last = tokens[tokens.length - 1];
  if (Array.isArray(parent)) return [parent, index(parent, last, false)];
  if (isObj(parent) && has(parent, last)) return [parent, last];
  throw new RangeError('path not found');
};

const remove = (doc, tokens) => {
  const [parent, key] = target(doc, tokens);
  if (Array.isArray(parent)) parent.splice(key, 1);
  else delete parent[key];
  return doc;
};

const replace = (doc, tokens, value) => {
  if (tokens.length === 0) return value;
  const [parent, key] = target(doc, tokens);
  if (Array.isArray(parent)) parent[key] = value;
  else setKey(parent, key, value);
  return doc;
};

const equal = (a, b) => {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => equal(x, b[i]));
  }
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => has(b, k) && equal(a[k], b[k]));
  }
  return a === b;
};

export function getPointer(doc, pointer) {
  return walk(doc, parse(pointer));
}

const NEEDS_VALUE = new Set(['add', 'replace', 'test']);
const NEEDS_FROM = new Set(['move', 'copy']);

export function applyPatch(doc, ops) {
  if (!Array.isArray(ops)) throw new TypeError('ops must be an array');
  let work = clone(doc);
  for (const op of ops) {
    if (!isObj(op) || typeof op.op !== 'string') throw new TypeError('bad operation');
    if (!NEEDS_VALUE.has(op.op) && !NEEDS_FROM.has(op.op) && op.op !== 'remove') {
      throw new TypeError(`unknown op ${op.op}`);
    }
    if (typeof op.path !== 'string') throw new TypeError('path must be a string');
    if (NEEDS_VALUE.has(op.op) && !has(op, 'value')) throw new TypeError('value is required');
    if (NEEDS_FROM.has(op.op) && typeof op.from !== 'string') throw new TypeError('from must be a string');
    const path = parse(op.path);
    const from = NEEDS_FROM.has(op.op) ? parse(op.from) : null;
    switch (op.op) {
      case 'add': work = add(work, path, clone(op.value)); break;
      case 'replace': work = replace(work, path, clone(op.value)); break;
      case 'remove': work = remove(work, path); break;
      case 'test':
        if (!equal(walk(work, path), op.value)) {
          throw Object.assign(new Error('test failed'), { name: 'TestFailed' });
        }
        break;
      case 'copy': work = add(work, path, clone(walk(work, from))); break;
      case 'move': {
        if (op.path === op.from) { walk(work, from); break; }
        if (op.path.startsWith(`${op.from}/`)) throw new RangeError('cannot move into own child');
        const value = walk(work, from);
        work = remove(work, from);
        work = add(work, path, value);
        break;
      }
    }
  }
  return work;
}
