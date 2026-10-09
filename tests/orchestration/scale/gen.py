#!/usr/bin/env python3
"""Корпус «миграция N модулей со старого API на новый» для замера оркестрации на большом объёме.

  python3 -I gen.py <каталог> --modules N [--seed S] [--variant old|ref|half]

Создаёт рабочее дерево <каталог>/ (то, что видит исполнитель) и скрытую директорию
<каталог>.hidden/ (грейдер, ожидаемые выходы, манифест хешей):

  <каталог>/lib/legacy.py, lib/money.py   старый и новый форматтер (разные умолчания)
  <каталог>/MIGRATION.md, PROMPT.md       правила миграции и поручение
  <каталог>/src/modNNN.py                 модули со старым API (variant old), либо решение
  <каталог>/tests/test_modNNN.py          видимые тесты: выходы старого кода на типичных входах
  <каталог>/run_tests.py                  проверка модуля: линт «нет legacy» + видимые тесты
  <каталог>.hidden/cases.json             расширенные входы с выходами старого кода (грейдер)

Вариант `ref` кладёт верное решение, `half` - почти верное (стиль учтён, округление и None нет):
нужны для проверки самого грейдера. Трудность модулей разная: прямая замена, позиционные
аргументы, ловушки (alias, строки и комментарии с тем же именем), partial и словари
форматтеров, проброс **kwargs со старыми именами ключей.
"""
import hashlib, json, os, pprint, random, shutil, subprocess, sys

sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))

LEGACY = '''"""Старый форматтер сумм (устарел, см. MIGRATION.md)."""
from decimal import Decimal, ROUND_HALF_EVEN


def fmt_amount(amount, ccy, nd=2, thousands=True):
    """Сумма с валютой после числа: "1,234.50 USD". Округление half-even, None -> "n/a"."""
    if amount is None:
        return "n/a"
    q = Decimal(str(amount)).quantize(Decimal(1).scaleb(-nd), rounding=ROUND_HALF_EVEN)
    s = f"{q:,.{nd}f}" if thousands else f"{q:.{nd}f}"
    return f"{s} {ccy}"
'''

MONEY = '''"""Новый форматтер сумм."""
from decimal import Decimal, ROUND_HALF_EVEN, ROUND_HALF_UP

_MODES = {"half_up": ROUND_HALF_UP, "half_even": ROUND_HALF_EVEN}


def format_money(value, currency, *, decimals=2, group=True, rounding="half_up",
                 none_text="", style="prefix"):
    """Сумма с валютой. По умолчанию: валюта перед числом ("USD 1,234.50"), округление half_up,
    None -> пустая строка. style="suffix" ставит валюту после числа."""
    if value is None:
        return none_text
    q = Decimal(str(value)).quantize(Decimal(1).scaleb(-decimals), rounding=_MODES[rounding])
    s = f"{q:,.{decimals}f}" if group else f"{q:.{decimals}f}"
    return f"{currency} {s}" if style == "prefix" else f"{s} {currency}"
'''

MIGRATION = '''# Миграция с `legacy.fmt_amount` на `money.format_money`

Старый вызов: `fmt_amount(amount, ccy, nd=2, thousands=True)`.
Новый вызов: `format_money(value, currency, *, decimals=2, group=True, rounding="half_up", none_text="", style="prefix")`.

Соответствие аргументов:

| Старое | Новое |
|---|---|
| `amount` | `value` |
| `ccy` | `currency` |
| `nd` | `decimals` |
| `thousands` | `group` |

**Умолчания у форматтеров разные.** Чтобы публичные функции модуля вернули ровно те же строки,
что и раньше, новый вызов обязан задать явно:

| Что | Старое поведение | Что передать в `format_money` |
|---|---|---|
| где валюта | после числа: `1,234.50 USD` | `style="suffix"` |
| округление | half-even (`0.125` -> `0.12`) | `rounding="half_even"` |
| `None` | строка `n/a` | `none_text="n/a"` |

Правила:
- `legacy` после миграции не импортируется и не упоминается в коде (комментарии и строки не считаются).
- Сигнатуры и поведение публичных функций модуля не меняются, включая имена их аргументов.
- Строки, ключи словарей и комментарии, где встречается имя `fmt_amount`, не вызовы: их не трогают.
- Каталоги `lib/` и `tests/` не правятся.
'''

PROMPT = '''В каталоге src/ лежат модули modNNN.py, которые форматируют суммы устаревшим legacy.fmt_amount.
Переведи каждый модуль на money.format_money по правилам из MIGRATION.md так, чтобы публичные
функции возвращали ровно те же строки, что и раньше, на любых входах. Файлы в lib/ и tests/ не
правь. Проверка модуля: `python3 run_tests.py modNNN` (печатает PASS или FAIL с причиной); для
всех сразу `python3 run_tests.py --all`. Модуль считается сделанным, когда по нему PASS.
Когда все модули сделаны, напиши краткий итог: сколько модулей PASS и какие не удались.
'''

RUN_TESTS = '''#!/usr/bin/env python3
"""Проверка модулей: python3 run_tests.py modNNN [modNNN ...] | --all
Печатает PASS modNNN либо FAIL modNNN: причина. Код выхода 0, только если все PASS."""
import ast, importlib.util, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))


def lint(path):
    tree = ast.parse(open(path, encoding="utf-8").read())
    for node in ast.walk(tree):
        if isinstance(node, ast.Import) and any(a.name.split(".")[0] == "legacy" for a in node.names):
            return "импорт legacy"
        if isinstance(node, ast.ImportFrom) and (node.module or "").split(".")[0] == "legacy":
            return "импорт из legacy"
        if isinstance(node, ast.Name) and node.id in ("legacy", "fmt_amount"):
            return f"имя {node.id} в коде"
        if isinstance(node, ast.Attribute) and node.attr == "fmt_amount":
            return "атрибут fmt_amount в коде"
    return None


def child(name):
    sys.path[:0] = [os.path.join(ROOT, "lib"), os.path.join(ROOT, "src")]
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, "src", name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    tspec = importlib.util.spec_from_file_location("t_" + name, os.path.join(ROOT, "tests", "test_" + name + ".py"))
    t = importlib.util.module_from_spec(tspec)
    tspec.loader.exec_module(t)
    for fn, args, kwargs, expected in t.CASES:
        got = getattr(mod, fn)(*args, **kwargs)
        if got != expected:
            print(f"{fn}({args}, {kwargs}): ждали {expected!r}, получили {got!r}")
            return 1
    return 0


def main():
    if len(sys.argv) >= 3 and sys.argv[1] == "--child":
        sys.exit(child(sys.argv[2]))
    names = sys.argv[1:]
    if names == ["--all"] or not names:
        names = sorted(f[:-3] for f in os.listdir(os.path.join(ROOT, "src")) if f.startswith("mod") and f.endswith(".py"))
    bad = 0
    for name in names:
        path = os.path.join(ROOT, "src", name + ".py")
        if not os.path.exists(path):
            print(f"FAIL {name}: нет файла"); bad += 1; continue
        try:
            reason = lint(path)
        except SyntaxError as e:
            reason = f"синтаксис: {e}"
        if reason:
            print(f"FAIL {name}: {reason}"); bad += 1; continue
        r = subprocess.run([sys.executable, "-I", os.path.abspath(__file__), "--child", name],
                           capture_output=True, text=True, timeout=60)
        if r.returncode != 0:
            msg = (r.stdout.strip() or r.stderr.strip().splitlines()[-1] if (r.stdout.strip() or r.stderr.strip()) else "ошибка")
            print(f"FAIL {name}: {msg[:200]}"); bad += 1
        else:
            print(f"PASS {name}")
    print(f"итого: {len(names) - bad} из {len(names)} PASS")
    sys.exit(1 if bad else 0)


main()
'''

CCYS = ["USD", "EUR", "GBP", "CHF", "JPY", "SEK", "NOK", "PLN"]
DOMAINS = ["invoice", "ledger", "payroll", "refund", "quote", "budget", "tariff", "payout",
           "statement", "receipt", "order", "fee", "deposit", "grant", "rebate", "levy"]
VIS_AMT = [0, 5, 12.5, 100, 249.99, 1200, 15000.5, 98765.43, 7, 310.4]
EDGE_AMT = [0.125, 1.005, 2.5, 0.5, 10.245, -0.125, -2.5, None, -1234.5, 999999.995, 1234567.891, 0.0, 0.375, -0.5]


def newcall(mode, val, ccy, nd=None, th=None):
    parts = [val, ccy]
    if nd is not None:
        parts.append(f"decimals={nd}")
    if th is not None:
        parts.append(f"group={th}")
    if mode == "ref":
        parts += ['rounding="half_even"', 'none_text="n/a"', 'style="suffix"']
    else:  # half
        parts += ['style="suffix"']
    return "format_money(" + ", ".join(parts) + ")"


def partial_kwargs(mode, ccy, nd):
    base = f'currency="{ccy}", decimals={nd}'
    if mode == "ref":
        return base + ', rounding="half_even", none_text="n/a", style="suffix"'
    return base + ', style="suffix"'


class T:
    """Шаблон функции модуля: имя, источник по режиму, входы."""
    klass = "A"

    def __init__(self, rng, fn, ccy):
        self.rng, self.fn, self.ccy = rng, fn, ccy

    def imports(self, mode):
        return ["from money import format_money"] if mode != "old" else ["from legacy import fmt_amount"]

    def pick(self, pool, k):
        return [self.rng.choice(pool) for _ in range(k)]


class A1(T):  # прямая замена, значение умножается
    klass = "A"

    def body(self, mode):
        old = f'"{self.fn}: " + fmt_amount(total, "{self.ccy}")'
        new = f'"{self.fn}: " + ' + newcall(mode, "total", f'"{self.ccy}"')
        return f'''def {self.fn}(price, qty):
    """Строка позиции: название и сумма."""
    total = None if price is None else price * qty
    return {old if mode == "old" else new}
'''

    def inputs(self, strong):
        vis = [([p, q], {}) for p, q in zip(self.pick([a for a in VIS_AMT], 4), self.pick([1, 2, 3, 10], 4))]
        if strong:
            vis.append(([None, 2], {}))
        hid = vis + [([p, q], {}) for p, q in zip(self.pick(EDGE_AMT, 10), self.pick([1, 2, 3], 10))]
        return vis, hid


class A2(T):  # import legacy / вызов через модуль
    klass = "A"

    def imports(self, mode):
        return ["import legacy"] if mode == "old" else ["from money import format_money"]

    def body(self, mode):
        call = f'legacy.fmt_amount(amount, "{self.ccy}")' if mode == "old" else newcall(mode, "amount", f'"{self.ccy}"')
        return f'''def {self.fn}(amount):
    return {call}
'''

    def inputs(self, strong):
        vis = [([a], {}) for a in self.pick(VIS_AMT, 4)]
        if strong:
            vis.append(([None], {}))
        return vis, vis + [([a], {}) for a in self.pick(EDGE_AMT, 10)]


class B1(T):  # позиционные nd и thousands внутри цикла
    klass = "B"

    def imports(self, mode):
        return ["import legacy"] if mode == "old" else ["from money import format_money"]

    def body(self, mode):
        call = (f'legacy.fmt_amount(amount, "{self.ccy}", places, False)' if mode == "old"
                else newcall(mode, "amount", f'"{self.ccy}"', "places", "False"))
        return f'''def {self.fn}(rows, places=2):
    lines = []
    for name, amount in rows:
        lines.append(name.ljust(10) + {call})
    return "\\n".join(lines)
'''

    def inputs(self, strong):
        def rows(pool, n):
            return [[f"r{i}", v] for i, v in enumerate(self.pick(pool, n))]
        vis = [([rows(VIS_AMT, 3), p], {}) for p in (0, 1, 2)]
        if strong:
            vis.append(([[["x", None], ["y", 5]], 2], {}))
        return vis, vis + [([rows(EDGE_AMT, 5), p], {}) for p in (0, 1, 2, 3)]


class B2(T):  # ключевые nd=, thousands=
    klass = "B"

    def body(self, mode):
        old = f'fmt_amount(diff, "{self.ccy}", nd=nd, thousands=True)'
        new = newcall(mode, "diff", f'"{self.ccy}"', "nd", "True")
        return f'''def {self.fn}(a, b, nd=2):
    diff = None if a is None or b is None else a - b
    return {old if mode == "old" else new}
'''

    def inputs(self, strong):
        vis = [([a, b], {"nd": n}) for a, b, n in zip(self.pick(VIS_AMT, 4), self.pick(VIS_AMT, 4), (0, 1, 2, 3))]
        if strong:
            vis.append(([None, 1], {}))
        return vis, vis + [([a, b], {"nd": n}) for a, b, n in zip(self.pick(EDGE_AMT, 8), self.pick(EDGE_AMT, 8), (0, 1, 2, 3, 0, 1, 2, 3)) if a is not None and b is not None]


class C1(T):  # ловушки: alias, имя в docstring, комментарии, строке и ключе словаря
    klass = "C"

    def imports(self, mode):
        return ["from legacy import fmt_amount as fa"] if mode == "old" else ["from money import format_money"]

    def body(self, mode):
        call = f'fa(amount, "{self.ccy}", 1)' if mode == "old" else newcall(mode, "amount", f'"{self.ccy}"', "1")
        return f'''LABELS_{self.fn} = {{"fmt_amount": "legacy formatter"}}


def {self.fn}(amount, note=None):
    """Форматирует сумму. Раньше звали legacy.fmt_amount(amount, ccy); имя fmt_amount в строках - метка."""
    # раньше: fmt_amount(amount, "{self.ccy}") - комментарий не трогать
    text = {call}
    if note:
        text += " (" + note + "; " + LABELS_{self.fn}["fmt_amount"] + ")"
    return text
'''

    def inputs(self, strong):
        vis = [([a], {}) for a in self.pick(VIS_AMT, 3)] + [([a], {"note": "ok"}) for a in self.pick(VIS_AMT, 2)]
        if strong:
            vis.append(([None], {"note": "n"}))
        return vis, vis + [([a], {"note": "e"}) for a in self.pick(EDGE_AMT, 8)]


class D1(T):  # functools.partial с ключевой валютой
    klass = "D"

    def imports(self, mode):
        return ["from functools import partial", "from legacy import fmt_amount"] if mode == "old" else ["from functools import partial", "from money import format_money"]

    def body(self, mode):
        mk = (f'partial(fmt_amount, ccy="{self.ccy}", nd=0)' if mode == "old"
              else f'partial(format_money, {partial_kwargs(mode, self.ccy, 0)})')
        return f'''def {self.fn}(values):
    fmt = {mk}
    return [fmt(v) for v in values]
'''

    def inputs(self, strong):
        vis = [([self.pick(VIS_AMT, 3)], {}) for _ in range(3)]
        if strong:
            vis.append(([[None, 3]], {}))
        return vis, vis + [([self.pick(EDGE_AMT, 5)], {}) for _ in range(4)]


class D2(T):  # словарь форматтеров-лямбд
    klass = "D"

    def body(self, mode):
        usd = 'fmt_amount(v, "USD", 0)' if mode == "old" else newcall(mode, "v", '"USD"', "0")
        eur = 'fmt_amount(v, "EUR", 2, False)' if mode == "old" else newcall(mode, "v", '"EUR"', "2", "False")
        return f'''FORMATTERS_{self.fn} = {{
    "usd": lambda v: {usd},
    "eur": lambda v: {eur},
}}


def {self.fn}(kind, value):
    return FORMATTERS_{self.fn}[kind](value)
'''

    def inputs(self, strong):
        vis = [([k, v], {}) for k, v in zip(("usd", "eur", "usd", "eur"), self.pick(VIS_AMT, 4))]
        if strong:
            vis.append((["usd", None], {}))
        return vis, vis + [([k, v], {}) for k, v in zip(("usd", "eur") * 5, self.pick(EDGE_AMT, 10))]


class E1(T):  # проброс **opts со старыми именами ключей
    klass = "E"

    def body(self, mode):
        if mode == "old":
            call = f'fmt_amount(value, "{self.ccy}", **opts)'
            return f'''def {self.fn}(value, **opts):
    return {call}
'''
        nd = 'opts.get("nd", 2)'
        th = 'opts.get("thousands", True)'
        call = newcall(mode, "value", f'"{self.ccy}"', nd, th)
        return f'''def {self.fn}(value, **opts):
    return {call}
'''

    def inputs(self, strong):
        vis = [([a], k) for a, k in zip(self.pick(VIS_AMT, 4), ({}, {"nd": 1}, {"thousands": False}, {"nd": 0, "thousands": False}))]
        if strong:
            vis.append(([None], {"nd": 1}))
        return vis, vis + [([a], k) for a, k in zip(self.pick(EDGE_AMT, 8), ({}, {"nd": 1}, {"nd": 3}, {"thousands": False}) * 2)]


WEIGHTED = [(A1, 22), (A2, 20), (B1, 10), (B2, 10), (C1, 15), (D1, 6), (D2, 7), (E1, 10)]


def build_module(rng, idx, strong):
    n_funcs = rng.choice([1, 2, 2, 3])
    ccy = rng.choice(CCYS)
    funcs = []
    used = set()
    for k in range(n_funcs):
        cls = rng.choices([c for c, _ in WEIGHTED], [w for _, w in WEIGHTED])[0]
        base = rng.choice(DOMAINS)
        fn = f"{base}_{idx:03d}_{chr(97 + k)}"
        if fn in used:
            continue
        used.add(fn)
        funcs.append(cls(rng, fn, ccy))
    return funcs


def render(funcs, mode, idx):
    imps = []
    for f in funcs:
        for line in f.imports(mode):
            if line not in imps:
                imps.append(line)
    head = '"""Модуль mod%03d: форматирование сумм."""\n' % idx
    imps = sorted(imps, key=lambda s: (not s.startswith("from functools"), s))
    return head + "\n".join(imps) + "\n\n\n" + "\n\n".join(f.body(mode) for f in funcs)


def import_module(path, libdir, name):
    import importlib.util
    sys.path[:0] = [libdir]
    try:
        spec = importlib.util.spec_from_file_location(name, path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    finally:
        sys.path.pop(0)


def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def main():
    argv = sys.argv[1:]
    out = os.path.abspath(argv[0])
    n = int(argv[argv.index("--modules") + 1])
    seed = int(argv[argv.index("--seed") + 1]) if "--seed" in argv else 7
    variant = argv[argv.index("--variant") + 1] if "--variant" in argv else "old"
    hidden = out + ".hidden"
    for d in (out, hidden):
        shutil.rmtree(d, ignore_errors=True)
    for sub in ("lib", "src", "tests"):
        os.makedirs(os.path.join(out, sub))
    os.makedirs(hidden)
    w = lambda p, s: open(p, "w", encoding="utf-8").write(s)
    w(f"{out}/lib/legacy.py", LEGACY); w(f"{out}/lib/money.py", MONEY)
    w(f"{out}/MIGRATION.md", MIGRATION); w(f"{out}/PROMPT.md", PROMPT); w(f"{out}/run_tests.py", RUN_TESTS)
    os.makedirs(f"{hidden}/orig")
    rng = random.Random(seed)
    cases, kinds = {}, {}
    for idx in range(1, n + 1):
        name = f"mod{idx:03d}"
        strong = rng.random() < 0.4
        funcs = build_module(rng, idx, strong)
        old_src = render(funcs, "old", idx)
        w(f"{hidden}/orig/{name}.py", old_src)
        w(f"{out}/src/{name}.py", render(funcs, variant if variant != "old" else "old", idx))
        orig = import_module(f"{hidden}/orig/{name}.py", f"{out}/lib", name)
        vis_cases, hid_cases = [], []
        for f in funcs:
            vis, hid = f.inputs(strong)
            for args, kwargs in vis:
                args, kwargs = json.loads(json.dumps(args)), json.loads(json.dumps(kwargs))
                vis_cases.append((f.fn, args, kwargs, getattr(orig, f.fn)(*args, **kwargs)))
            for args, kwargs in hid:
                args, kwargs = json.loads(json.dumps(args)), json.loads(json.dumps(kwargs))
                hid_cases.append({"fn": f.fn, "args": args, "kwargs": kwargs, "expected": getattr(orig, f.fn)(*args, **kwargs)})
        w(f"{out}/tests/test_{name}.py", "CASES = " + pprint.pformat(vis_cases, width=100) + "\n")
        cases[name] = hid_cases
        kinds[name] = {"classes": sorted({f.klass for f in funcs}), "strong_visible": strong}
    json.dump(cases, open(f"{hidden}/cases.json", "w", encoding="utf-8"), ensure_ascii=False)
    manifest = {"kinds": kinds, "hashes": {}}
    shutil.rmtree(f"{out}/lib/__pycache__", ignore_errors=True)
    for sub in ("lib", "tests"):
        for fn in sorted(os.listdir(f"{out}/{sub}")):
            if os.path.isfile(f"{out}/{sub}/{fn}"):
                manifest["hashes"][f"{sub}/{fn}"] = sha(f"{out}/{sub}/{fn}")
    manifest["hashes"]["run_tests.py"] = sha(f"{out}/run_tests.py")
    json.dump(manifest, open(f"{hidden}/manifest.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    shutil.copy(f"{HERE}/grade.py", f"{hidden}/grade.py")
    size = sum(os.path.getsize(f"{out}/src/{f}") for f in os.listdir(f"{out}/src"))
    print(f"модулей {n}, src {size} байт, вариант {variant}, скрытая директория {hidden}")


main()
