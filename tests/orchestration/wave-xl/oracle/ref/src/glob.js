const GLOBSTAR_SEGMENT = '(?!\\.)[^/]+(?:/(?!\\.)[^/]+)*';

const esc = (c) => (/[A-Za-z0-9_]/.test(c) ? c : '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

function scanClass(s, i) {
  let j = i + 1;
  if (s[j] === '!') j++;
  if (s[j] === ']') throw new SyntaxError('empty class');
  while (j < s.length) {
    if (s[j] === '\\') {
      j += 2;
      continue;
    }
    if (s[j] === ']') return j;
    j++;
  }
  throw new SyntaxError('unclosed [');
}

function expand(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') {
      if (i + 1 >= s.length) throw new SyntaxError('trailing backslash');
      i++;
      continue;
    }
    if (c === '[') {
      i = scanClass(s, i);
      continue;
    }
    if (c !== '{') continue;
    const alts = [];
    let depth = 0;
    let start = i + 1;
    let end = -1;
    for (let j = i + 1; j < s.length; j++) {
      const d = s[j];
      if (d === '\\') {
        j++;
      } else if (d === '[') {
        j = scanClass(s, j);
      } else if (d === '{') {
        depth++;
      } else if (d === '}') {
        if (depth === 0) {
          end = j;
          break;
        }
        depth--;
      } else if (d === ',' && depth === 0) {
        alts.push(s.slice(start, j));
        start = j + 1;
      }
    }
    if (end < 0) throw new SyntaxError('unclosed {');
    alts.push(s.slice(start, end));
    const head = s.slice(0, i);
    const tail = s.slice(end + 1);
    return alts.flatMap((a) => expand(head + a + tail));
  }
  return [s];
}

function parseClass(s, i) {
  const end = scanClass(s, i);
  let body = s.slice(i + 1, end);
  const neg = body[0] === '!';
  if (neg) body = body.slice(1);
  const ch = [];
  for (let k = 0; k < body.length; k++) {
    if (body[k] === '\\') ch.push({ c: body[++k], esc: true });
    else ch.push({ c: body[k], esc: false });
  }
  let members = '';
  for (let m = 0; m < ch.length; m++) {
    const dash = ch[m + 1];
    if (dash && dash.c === '-' && !dash.esc && ch[m + 2]) {
      const lo = ch[m].c;
      const hi = ch[m + 2].c;
      if (lo > hi) throw new SyntaxError('reversed range');
      members += esc(lo) + '-' + esc(hi);
      m += 2;
    } else {
      members += esc(ch[m].c);
    }
  }
  return { end, tok: { k: 'cls', re: `(?!/)[${neg ? '^' : ''}${members}]` } };
}

function tokenize(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') out.push({ k: 'lit', c: s[++i] });
    else if (c === '*') out.push({ k: 'star' });
    else if (c === '?') out.push({ k: 'any' });
    else if (c === '/') out.push({ k: 'sep' });
    else if (c === '[') {
      const { end, tok } = parseClass(s, i);
      out.push(tok);
      i = end;
    } else out.push({ k: 'lit', c });
  }
  return out;
}

const tokenRe = (t) => {
  if (t.k === 'star') return '[^/]*';
  if (t.k === 'any') return '[^/]';
  if (t.k === 'cls') return t.re;
  return esc(t.c);
};

function compileOne(s) {
  const segments = [[]];
  for (const t of tokenize(s)) {
    if (t.k === 'sep') segments.push([]);
    else segments[segments.length - 1].push(t);
  }
  const items = [];
  for (const seg of segments) {
    const globstar = seg.length === 2 && seg[0].k === 'star' && seg[1].k === 'star';
    if (globstar) {
      if (items.length === 0 || items[items.length - 1] !== null) items.push(null);
      continue;
    }
    const wild = seg.length > 0 && seg[0].k !== 'lit';
    items.push((wild ? '(?!\\.)' : '') + seg.map(tokenRe).join(''));
  }
  let out = '';
  let needSep = false;
  items.forEach((item, idx) => {
    if (item !== null) {
      out += (needSep ? '/' : '') + item;
      needSep = true;
    } else if (idx === 0 && items.length === 1) {
      out += `(?:${GLOBSTAR_SEGMENT})?`;
    } else if (idx === 0) {
      out += `(?:${GLOBSTAR_SEGMENT}/)?`;
    } else {
      out += `(?:/${GLOBSTAR_SEGMENT})?`;
      needSep = true;
    }
  });
  return out;
}

export function globToRegExp(pattern) {
  return new RegExp('^(?:' + expand(pattern).map(compileOne).join('|') + ')$');
}

export function isMatch(path, pattern) {
  return globToRegExp(pattern).test(path);
}
