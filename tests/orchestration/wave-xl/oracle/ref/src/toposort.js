function normalize(graph) {
  const proto = graph === null || typeof graph !== 'object' ? undefined : Object.getPrototypeOf(graph);
  if (proto !== Object.prototype && proto !== null) throw new TypeError('graph must be a plain object');
  const deps = new Map();
  for (const key of Object.keys(graph)) {
    const list = graph[key];
    if (!Array.isArray(list) || list.some((d) => typeof d !== 'string')) {
      throw new TypeError(`deps of ${key} must be an array of strings`);
    }
    deps.set(key, [...new Set(list)].sort());
  }
  for (const list of [...deps.values()]) {
    for (const d of list) if (!deps.has(d)) deps.set(d, []);
  }
  return deps;
}

function checkCycle(deps) {
  const state = new Map();
  const path = [];
  const visit = (node) => {
    state.set(node, 1);
    path.push(node);
    for (const d of deps.get(node)) {
      const s = state.get(d);
      if (s === 1) {
        const cycle = path.slice(path.indexOf(d));
        cycle.push(d);
        const err = new Error(`cycle: ${cycle.join(' -> ')}`);
        err.name = 'CycleError';
        err.cycle = cycle;
        throw err;
      }
      if (s === undefined) visit(d);
    }
    path.pop();
    state.set(node, 2);
  };
  for (const node of [...deps.keys()].sort()) {
    if (!state.has(node)) visit(node);
  }
}

export function toposort(graph) {
  const deps = normalize(graph);
  checkCycle(deps);
  const pending = new Map();
  const dependents = new Map();
  for (const [node, list] of deps) {
    pending.set(node, list.length);
    for (const d of list) {
      if (!dependents.has(d)) dependents.set(d, []);
      dependents.get(d).push(node);
    }
  }
  const ready = [...deps.keys()].filter((n) => pending.get(n) === 0);
  const order = [];
  while (ready.length) {
    ready.sort();
    const node = ready.shift();
    order.push(node);
    for (const next of dependents.get(node) ?? []) {
      pending.set(next, pending.get(next) - 1);
      if (pending.get(next) === 0) ready.push(next);
    }
  }
  return order;
}

export function layers(graph) {
  const deps = normalize(graph);
  checkCycle(deps);
  const depth = new Map();
  const depthOf = (node) => {
    if (depth.has(node)) return depth.get(node);
    let d = 0;
    for (const dep of deps.get(node)) d = Math.max(d, depthOf(dep) + 1);
    depth.set(node, d);
    return d;
  };
  const result = [];
  for (const node of [...deps.keys()].sort()) {
    const d = depthOf(node);
    (result[d] ??= []).push(node);
  }
  return result;
}
