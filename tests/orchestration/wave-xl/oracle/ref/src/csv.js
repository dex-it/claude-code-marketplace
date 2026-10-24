function delimiterOf(options) {
  const d = options?.delimiter;
  if (d === undefined) return ',';
  if (typeof d !== 'string' || d.length !== 1 || d === '"' || d === '\r' || d === '\n') {
    throw new RangeError('invalid delimiter');
  }
  return d;
}

function fail(what, line) {
  return new SyntaxError(`${what} (line ${line})`);
}

export function parse(text, options) {
  const d = delimiterOf(options);
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  const n = text.length;
  const rows = [];
  let i = 0;
  let line = 1;
  while (i < n) {
    const row = [];
    for (;;) {
      const startLine = line;
      let field;
      if (text[i] === '"') {
        i++;
        field = '';
        for (;;) {
          if (i >= n) throw fail('unclosed quote', startLine);
          const c = text[i];
          if (c === '"') {
            if (text[i + 1] === '"') {
              field += '"';
              i += 2;
              continue;
            }
            i++;
            break;
          }
          if (c === '\n') line++;
          field += c;
          i++;
        }
        const c = text[i];
        const ok = i >= n || c === d || c === '\n' || (c === '\r' && text[i + 1] === '\n');
        if (!ok) throw fail('unexpected character after closing quote', startLine);
      } else {
        let j = i;
        while (j < n && text[j] !== d && text[j] !== '\n' && text[j] !== '\r' && text[j] !== '"') j++;
        if (j < n && (text[j] === '"' || (text[j] === '\r' && text[j + 1] !== '\n'))) {
          throw fail('unexpected character in unquoted field', startLine);
        }
        field = text.slice(i, j);
        i = j;
      }
      row.push(field);
      if (i >= n) break;
      if (text[i] === d) {
        i++;
        continue;
      }
      i += text[i] === '\r' ? 2 : 1;
      line++;
      break;
    }
    rows.push(row);
  }
  return rows;
}

export function stringify(rows, options) {
  const d = delimiterOf(options);
  return rows
    .map((row) => {
      const cells = row.map(String);
      if (cells.length === 1 && cells[0] === '') return '""';
      return cells
        .map((s) => (/["\r\n]/.test(s) || s.includes(d) ? `"${s.replaceAll('"', '""')}"` : s))
        .join(d);
    })
    .join('\r\n');
}
