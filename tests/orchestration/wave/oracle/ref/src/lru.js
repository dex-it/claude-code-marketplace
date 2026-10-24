import { parseDuration } from './duration.js';

export class LruCache {
  #max; #ttl; #now; #map = new Map();
  constructor(max, options = {}) {
    if (!Number.isInteger(max) || max <= 0) throw new RangeError('max');
    if (options.ttl !== undefined && options.ttlMs !== undefined) throw new TypeError('ttl and ttlMs');
    let ttl = options.ttl !== undefined ? options.ttl : options.ttlMs;
    if (typeof ttl === 'string') ttl = parseDuration(ttl);
    this.#max = max; this.#ttl = ttl; this.#now = options.now || Date.now;
  }
  get ttl() { return this.#ttl; }
  #alive(e) { return this.#ttl === undefined || this.#now() - e.at < this.#ttl; }
  #purge() { for (const [k, e] of this.#map) if (!this.#alive(e)) this.#map.delete(k); }
  get(key) {
    const e = this.#map.get(key);
    if (!e) return undefined;
    if (!this.#alive(e)) { this.#map.delete(key); return undefined; }
    this.#map.delete(key); this.#map.set(key, e);
    return e.value;
  }
  set(key, value) {
    this.#map.delete(key);
    this.#map.set(key, { value, at: this.#now() });
    this.#purge();
    while (this.#map.size > this.#max) this.#map.delete(this.#map.keys().next().value);
    return this;
  }
  has(key) { const e = this.#map.get(key); return !!e && this.#alive(e); }
  delete(key) { return this.#map.delete(key); }
  clear() { this.#map.clear(); }
  get size() { this.#purge(); return this.#map.size; }
  keys() { this.#purge(); return [...this.#map.keys()]; }
}
