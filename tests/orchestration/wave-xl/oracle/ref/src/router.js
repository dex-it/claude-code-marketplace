const split = (path) => {
  const segs = path.slice(1).split('/');
  if (segs[segs.length - 1] === '') segs.pop();
  return segs;
};

const node = () => ({ statics: new Map(), param: null, wild: null, handlers: new Map() });

const decode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
};

export class Router {
  #root = node();

  add(method, pattern, handler) {
    if (typeof method !== 'string' || typeof pattern !== 'string' || !pattern.startsWith('/')) {
      throw new TypeError('invalid method or pattern');
    }
    const m = method.toUpperCase();
    const segs = split(pattern);
    const names = [];
    const key = [];
    let cur = this.#root;
    segs.forEach((seg, i) => {
      if (seg === '') throw new TypeError('empty segment');
      if (seg[0] === ':') {
        if (seg.length === 1) throw new TypeError('empty param name');
        names.push(seg.slice(1));
        key.push(':');
        cur = cur.param ??= node();
      } else if (seg[0] === '*') {
        if (seg.length === 1) throw new TypeError('empty wildcard name');
        if (i !== segs.length - 1) throw new TypeError('wildcard must be last');
        names.push(seg.slice(1));
        key.push('*');
        cur = cur.wild ??= node();
      } else {
        key.push(seg);
        if (!cur.statics.has(seg)) cur.statics.set(seg, node());
        cur = cur.statics.get(seg);
      }
    });
    if (cur.handlers.has(m)) throw new Error(`duplicate route: ${m} /${key.join('/')}`);
    cur.handlers.set(m, { handler, names });
    return this;
  }

  match(method, path) {
    const m = String(method).toUpperCase();
    const q = path.indexOf('?');
    const segs = split(q === -1 ? path : path.slice(0, q));
    let hit = this.#find(this.#root, segs, 0, m, []);
    if (!hit && m === 'HEAD') hit = this.#find(this.#root, segs, 0, 'GET', []);
    if (hit) {
      const params = {};
      hit.entry.names.forEach((n, i) => { params[n] = hit.vals[i]; });
      return { handler: hit.entry.handler, params };
    }
    const allow = new Set();
    this.#collect(this.#root, segs, 0, allow);
    if (allow.size) return { status: 405, allow: [...allow].sort() };
    return { status: 404 };
  }

  #find(n, segs, i, m, vals) {
    if (i === segs.length) {
      const entry = n.handlers.get(m);
      if (entry) return { entry, vals: [...vals] };
      const w = n.wild?.handlers.get(m);
      return w ? { entry: w, vals: [...vals, ''] } : null;
    }
    const seg = segs[i];
    const s = n.statics.get(seg);
    if (s) {
      const r = this.#find(s, segs, i + 1, m, vals);
      if (r) return r;
    }
    if (n.param && seg !== '') {
      const d = decode(seg);
      if (d !== null) {
        vals.push(d);
        const r = this.#find(n.param, segs, i + 1, m, vals);
        vals.pop();
        if (r) return r;
      }
    }
    const w = n.wild?.handlers.get(m);
    if (w) {
      const d = decode(segs.slice(i).join('/'));
      if (d !== null) return { entry: w, vals: [...vals, d] };
    }
    return null;
  }

  #collect(n, segs, i, out) {
    if (i === segs.length) {
      for (const k of n.handlers.keys()) out.add(k);
      if (n.wild) for (const k of n.wild.handlers.keys()) out.add(k);
      return;
    }
    const seg = segs[i];
    const s = n.statics.get(seg);
    if (s) this.#collect(s, segs, i + 1, out);
    if (n.param && seg !== '' && decode(seg) !== null) this.#collect(n.param, segs, i + 1, out);
    if (n.wild && decode(segs.slice(i).join('/')) !== null) {
      for (const k of n.wild.handlers.keys()) out.add(k);
    }
  }
}
