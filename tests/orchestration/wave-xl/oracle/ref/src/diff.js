const splitLines = (s) => {
  if (s === '') return [];
  const lines = s.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
};

const checkText = (name, v) => {
  if (typeof v !== 'string') throw new TypeError(`${name}: ожидалась строка`);
};

const compute = (x, y) => {
  const n = x.length;
  const m = y.length;
  const w = m + 1;
  const L = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i * w + j] = x[i] === y[j]
        ? L[(i + 1) * w + j + 1] + 1
        : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
    }
  }
  const raw = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) {
      raw.push({ op: 'equal', line: x[i] });
      i++;
      j++;
    } else if (j < m && (i === n || L[i * w + j + 1] >= L[(i + 1) * w + j])) {
      raw.push({ op: 'insert', line: y[j++] });
    } else {
      raw.push({ op: 'delete', line: x[i++] });
    }
  }
  // Блок изменений обязан быть "все delete, затем все insert", обход же их чередует.
  const out = [];
  let dels = [];
  let ins = [];
  const flush = () => {
    out.push(...dels, ...ins);
    dels = [];
    ins = [];
  };
  for (const o of raw) {
    if (o.op === 'equal') {
      flush();
      out.push(o);
    } else if (o.op === 'delete') dels.push(o);
    else ins.push(o);
  }
  flush();
  return out;
};

export function diffLines(a, b) {
  checkText('a', a);
  checkText('b', b);
  return compute(splitLines(a), splitLines(b));
}

const range = (start, len) => {
  if (len === 0) return `${start},0`;
  return len === 1 ? `${start + 1}` : `${start + 1},${len}`;
};

export function unifiedDiff(a, b, options) {
  checkText('a', a);
  checkText('b', b);
  if (options === undefined) options = {};
  if (options === null || typeof options !== 'object') throw new TypeError('options: ожидался объект');
  const context = options.context === undefined ? 3 : options.context;
  if (!Number.isInteger(context) || context < 0) throw new RangeError('context: целое >= 0');
  const fromFile = options.fromFile ?? 'a';
  const toFile = options.toFile ?? 'b';
  const ops = diffLines(a, b);
  const changed = [];
  ops.forEach((o, k) => { if (o.op !== 'equal') changed.push(k); });
  if (changed.length === 0) return '';

  const groups = [];
  for (const k of changed) {
    const last = groups[groups.length - 1];
    if (last && k - last.end - 1 <= 2 * context) last.end = k;
    else groups.push({ start: k, end: k });
  }

  const before = new Array(ops.length + 1);
  const beforeB = new Array(ops.length + 1);
  let ca = 0;
  let cb = 0;
  for (let k = 0; k < ops.length; k++) {
    before[k] = ca;
    beforeB[k] = cb;
    if (ops[k].op !== 'insert') ca++;
    if (ops[k].op !== 'delete') cb++;
  }

  const out = [`--- ${fromFile}`, `+++ ${toFile}`];
  for (const g of groups) {
    const from = Math.max(0, g.start - context);
    const to = Math.min(ops.length - 1, g.end + context);
    const slice = ops.slice(from, to + 1);
    const la = slice.filter((o) => o.op !== 'insert').length;
    const lb = slice.filter((o) => o.op !== 'delete').length;
    out.push(`@@ -${range(before[from], la)} +${range(beforeB[from], lb)} @@`);
    for (const o of slice) out.push((o.op === 'equal' ? ' ' : o.op === 'delete' ? '-' : '+') + o.line);
  }
  return out.join('\n') + '\n';
}
