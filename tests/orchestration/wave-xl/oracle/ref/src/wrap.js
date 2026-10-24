const WORD = /\S+/g;

export function wrap(text, width, options = {}) {
  const { indent = '', hard = false } = options;
  const firstIndent = options.firstIndent ?? indent;
  if (!Number.isInteger(width) || width <= indent.length || width <= firstIndent.length) {
    throw new RangeError(`bad width ${width}`);
  }

  const paragraphs = [];
  let words = [];
  for (const line of text.split('\n')) {
    const found = line.match(WORD);
    if (found) words.push(...found);
    else if (words.length) {
      paragraphs.push(words);
      words = [];
    }
  }
  if (words.length) paragraphs.push(words);

  return paragraphs.map((ws) => wrapParagraph(ws, width, indent, firstIndent, hard)).join('\n\n');
}

function wrapParagraph(words, width, indent, firstIndent, hard) {
  const lines = [];
  let cur = '';
  const prefix = () => (lines.length === 0 ? firstIndent : indent);
  const room = () => width - prefix().length;

  for (let w of words) {
    if (cur === '' ? w.length <= room() : cur.length + 1 + w.length <= room()) {
      cur = cur === '' ? w : `${cur} ${w}`;
      continue;
    }
    if (cur !== '') {
      lines.push(prefix() + cur);
      cur = '';
    }
    if (w.length <= room()) {
      cur = w;
      continue;
    }
    if (!hard) {
      lines.push(prefix() + w);
      continue;
    }
    while (w.length > room()) {
      const n = room();
      lines.push(prefix() + w.slice(0, n));
      w = w.slice(n);
    }
    cur = w;
  }
  if (cur !== '') lines.push(prefix() + cur);
  return lines.join('\n');
}

export function justify(line, width) {
  if (!Number.isInteger(width)) throw new RangeError(`bad width ${width}`);
  const words = line.match(WORD) ?? [];
  if (words.length < 2 || line.length >= width || words.join(' ').length >= width) return line;
  const gaps = words.length - 1;
  const spaces = width - words.reduce((n, w) => n + w.length, 0);
  const base = Math.floor(spaces / gaps);
  const extra = spaces % gaps;
  let out = words[0];
  for (let i = 1; i < words.length; i++) {
    out += ' '.repeat(base + (i <= extra ? 1 : 0)) + words[i];
  }
  return out;
}
