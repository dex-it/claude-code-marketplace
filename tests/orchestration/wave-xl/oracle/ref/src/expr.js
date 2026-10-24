const TOKEN = /\s+|((?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(.)/gy;

function tokenize(text) {
  const out = [];
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(text)) !== null) {
    if (m[1] !== undefined) out.push({ t: 'num', v: Number(m[1]), pos: m.index });
    else if (m[2] !== undefined) out.push({ t: 'id', v: m[2], pos: m.index });
    else if (m[3] !== undefined) {
      out.push({ t: '+-*/%^(),'.includes(m[3]) ? m[3] : 'bad', v: m[3], pos: m.index });
    }
  }
  out.push({ t: 'end', pos: text.length });
  return out;
}

function parse(text) {
  const toks = tokenize(text);
  let i = 0;
  const peek = () => toks[i];
  const fail = (tok) => {
    const e = new SyntaxError(`Unexpected token at ${tok.pos}`);
    e.pos = tok.pos;
    return e;
  };
  const expect = (t) => {
    if (peek().t !== t) throw fail(peek());
    return toks[i++];
  };

  function expr() {
    let left = term();
    while (peek().t === '+' || peek().t === '-') {
      const op = toks[i++].t;
      left = { k: 'bin', op, l: left, r: term() };
    }
    return left;
  }
  function term() {
    let left = unary();
    while (peek().t === '*' || peek().t === '/' || peek().t === '%') {
      const op = toks[i++].t;
      left = { k: 'bin', op, l: left, r: unary() };
    }
    return left;
  }
  function unary() {
    if (peek().t === '-' || peek().t === '+') {
      const op = toks[i++].t;
      return { k: 'neg', op, x: unary() };
    }
    return power();
  }
  function power() {
    const base = primary();
    if (peek().t === '^') {
      i++;
      return { k: 'bin', op: '^', l: base, r: unary() };
    }
    return base;
  }
  function primary() {
    const tok = peek();
    if (tok.t === 'num') {
      i++;
      return { k: 'num', v: tok.v };
    }
    if (tok.t === 'id') {
      i++;
      if (peek().t === '(') {
        i++;
        const args = [];
        if (peek().t !== ')') {
          args.push(expr());
          while (peek().t === ',') {
            i++;
            args.push(expr());
          }
        }
        expect(')');
        return { k: 'call', name: tok.v, args };
      }
      return { k: 'var', name: tok.v };
    }
    if (tok.t === '(') {
      i++;
      const inner = expr();
      expect(')');
      return inner;
    }
    throw fail(tok);
  }

  const tree = expr();
  if (peek().t !== 'end') throw fail(peek());
  return tree;
}

const FUNCS = {
  min: { check: (n) => n >= 1, fn: Math.min },
  max: { check: (n) => n >= 1, fn: Math.max },
  abs: { check: (n) => n === 1, fn: Math.abs },
  round: { check: (n) => n === 1, fn: Math.round },
};

const finite = (v) => {
  if (!Number.isFinite(v)) throw new RangeError('Non-finite result');
  return v;
};

function run(node, vars) {
  switch (node.k) {
    case 'num':
      return finite(node.v);
    case 'var':
      if (!Object.hasOwn(vars, node.name)) throw new ReferenceError(`Unknown variable ${node.name}`);
      return vars[node.name];
    case 'neg': {
      const x = run(node.x, vars);
      return node.op === '-' ? -x : x;
    }
    case 'call': {
      if (!Object.hasOwn(FUNCS, node.name)) throw new ReferenceError(`Unknown function ${node.name}`);
      const f = FUNCS[node.name];
      const args = node.args.map((a) => run(a, vars));
      if (!f.check(args.length)) throw new TypeError(`Wrong argument count for ${node.name}`);
      return finite(f.fn(...args));
    }
    default: {
      const l = run(node.l, vars);
      const r = run(node.r, vars);
      switch (node.op) {
        case '+': return finite(l + r);
        case '-': return finite(l - r);
        case '*': return finite(l * r);
        case '/':
          if (r === 0) throw new RangeError('Division by zero');
          return finite(l / r);
        case '%':
          if (r === 0) throw new RangeError('Modulo by zero');
          return finite(l % r);
        default: return finite(Math.pow(l, r));
      }
    }
  }
}

export function evaluate(text, vars = {}) {
  return run(parse(text), vars) + 0;
}
