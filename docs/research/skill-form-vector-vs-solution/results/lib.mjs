// Общее для collect.mjs и analyze.mjs: CSV с кавычками и статистика долей.

export function parseCsv(text) {
  const rows = [];
  let row = []; let field = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1 || r[0] !== '');
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

export function toCsv(rows, cols) {
  const esc = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replaceAll('"', '""')}"` : (v ?? ''));
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}

const Z = 1.959963984540054;

// 95% интервал Уилсона для k/n.
export function wilson(k, n) {
  if (!n) return [NaN, NaN];
  const p = k / n; const z2 = Z * Z;
  const c = (p + z2 / (2 * n)) / (1 + z2 / n);
  const h = (Z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

// Разность p1 - p2 с 95% интервалом Ньюкомба (гибридный score, метод 10 Newcombe 1998).
export function newcombe(k1, n1, k2, n2) {
  const p1 = k1 / n1; const p2 = k2 / n2;
  const [l1, u1] = wilson(k1, n1); const [l2, u2] = wilson(k2, n2);
  const d = p1 - p2;
  return [d, d - Math.sqrt((p1 - l1) ** 2 + (u2 - p2) ** 2), d + Math.sqrt((u1 - p1) ** 2 + (p2 - l2) ** 2)];
}

function logFact(n) { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; }

// Точный двусторонний тест Фишера для таблицы [[a, b], [c, d]].
export function fisher(a, b, c, d) {
  const r1 = a + b; const r2 = c + d; const c1 = a + c; const n = r1 + r2;
  const lp = (x) => logFact(r1) + logFact(r2) + logFact(c1) + logFact(n - c1) - logFact(n) - logFact(x) - logFact(r1 - x) - logFact(c1 - x) - logFact(r2 - c1 + x);
  const p0 = lp(a);
  let p = 0;
  for (let x = Math.max(0, c1 - r2); x <= Math.min(r1, c1); x++) {
    const px = lp(x);
    if (px <= p0 + 1e-9) p += Math.exp(px);
  }
  return Math.min(1, p);
}
