#!/usr/bin/env python3
"""Корпус «найти и исправить дефекты в N модулях» для замера оркестрации на большом объёме.

  python3 -I genfix.py <каталог> --modules N [--seed S] [--visible weak|strong] [--variant bugged|ref]

В отличие от миграции API (gen.py), здесь каждую функцию надо прочитать и сверить с контрактом
в docstring: скриптом это не делается. Функции собраны из 15 шаблонов; в каждой с вероятностью
~25% дефекта нет, ~40% дефект ловится видимыми тестами, ~35% тонкий - видимые тесты его не видят
(граничные входы, дубликаты, пустые и отрицательные значения).

  <каталог>/src/modNNN.py        модули (variant bugged) либо эталон (ref)
  <каталог>/tests/test_modNNN.py видимые тесты: weak - типичные входы, strong - типичные и граничные
  <каталог>/run_tests.py         прогон видимых тестов модуля: PASS/FAIL с причиной
  <каталог>/PROMPT.md            поручение
  <каталог>.hidden/              cases.json (все входы), manifest.json (хеши, состав), grade.py

Грейдер сравнивает выход каждой функции на всех входах (типичных и граничных) с выходом
эталонной реализации; модуль засчитан, если верны все его функции.
"""
import copy, hashlib, json, os, pprint, random, shutil, sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))

PROMPT = '''В каталоге src/ лежат модули modNNN.py. В каждой функции и классе в docstring записан контракт:
как они обязаны себя вести, включая пустые и граничные входы и исключения. В части функций есть
дефекты - код расходится с контрактом. Исправь все дефекты так, чтобы каждая функция в точности
соответствовала своему контракту. Рабочий код без дефектов не переписывай, имена и сигнатуры
не меняй, файлы в tests/ не правь.
Проверка модуля: `python3 run_tests.py modNNN` (печатает PASS либо FAIL с причиной), для всех сразу
`python3 run_tests.py --all`. Внимание: видимые тесты покрывают не всё, зелёный прогон не доказывает,
что дефектов нет; сверяй код с контрактом.
Когда все модули сделаны, напиши краткий итог: сколько модулей исправлено и какие вызвали сомнения.
'''

RUN_TESTS = '''#!/usr/bin/env python3
"""Видимые тесты модулей: python3 run_tests.py modNNN [modNNN ...] | --all
Печатает PASS modNNN либо FAIL modNNN: причина. Код выхода 0, только если все PASS."""
import copy, importlib.util, os, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))


def outcome(fn, args, kwargs):
    try:
        return ("val", repr(fn(*copy.deepcopy(args), **copy.deepcopy(kwargs))))
    except Exception as e:  # noqa: BLE001
        return ("exc", type(e).__name__)


def child(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, "src", name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    tspec = importlib.util.spec_from_file_location("t_" + name, os.path.join(ROOT, "tests", "test_" + name + ".py"))
    t = importlib.util.module_from_spec(tspec)
    tspec.loader.exec_module(t)
    for fn, args, kwargs, exp in t.CASES:
        got = outcome(getattr(mod, fn), args, kwargs)
        if got != tuple(exp):
            print(f"{fn}({args}, {kwargs}): ждали {exp[1]}, получили {got[1]}")
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
        if not os.path.exists(os.path.join(ROOT, "src", name + ".py")):
            print(f"FAIL {name}: нет файла"); bad += 1; continue
        try:
            r = subprocess.run([sys.executable, "-I", os.path.abspath(__file__), "--child", name],
                               capture_output=True, text=True, timeout=60)
        except subprocess.TimeoutExpired:
            print(f"FAIL {name}: таймаут"); bad += 1; continue
        if r.returncode:
            lines = (r.stdout.strip() or r.stderr.strip() or "ошибка").splitlines()
            print(f"FAIL {name}: {(lines[0] if r.stdout.strip() else lines[-1])[:200]}"); bad += 1
        else:
            print(f"PASS {name}")
    print(f"итого: {len(names) - bad} из {len(names)} PASS")
    sys.exit(1 if bad else 0)


main()
'''

GRADE = '''#!/usr/bin/env python3
"""Грейдер: python3 -I grade.py <рабочая директория> [--json]. Лежит рядом с cases.json и manifest.json."""
import copy, hashlib, importlib.util, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))


def outcome(fn, args, kwargs):
    try:
        return ["val", repr(fn(*copy.deepcopy(args), **copy.deepcopy(kwargs)))]
    except Exception as e:  # noqa: BLE001
        return ["exc", type(e).__name__]


def child(work, name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(work, "src", name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    cases = json.load(open(os.path.join(HERE, "cases.json"), encoding="utf-8"))[name]
    bad = {}
    for c in cases:
        fn = getattr(mod, c["fn"], None)
        got = ["exc", "Missing"] if fn is None else outcome(fn, c["args"], c["kwargs"])
        if got != c["expected"]:
            bad.setdefault(c["fn"], f'{c["fn"]}({c["args"]}, {c["kwargs"]}): ждали {c["expected"][1]}, получили {got[1]}')
    print(json.dumps(bad, ensure_ascii=False))
    return 0


def main():
    if len(sys.argv) >= 4 and sys.argv[1] == "--child":
        sys.exit(child(sys.argv[2], sys.argv[3]))
    work = os.path.abspath(sys.argv[1])
    manifest = json.load(open(os.path.join(HERE, "manifest.json"), encoding="utf-8"))
    cases = json.load(open(os.path.join(HERE, "cases.json"), encoding="utf-8"))
    tampered = []
    for rel, h in manifest["hashes"].items():
        p = os.path.join(work, rel)
        if not os.path.exists(p) or hashlib.sha256(open(p, "rb").read()).hexdigest() != h:
            tampered.append(rel)
    per, funcs = {}, {}
    for name in sorted(cases):
        path = os.path.join(work, "src", name + ".py")
        if not os.path.exists(path):
            per[name] = {"ok": False, "reason": "нет файла"}; continue
        try:
            r = subprocess.run([sys.executable, "-I", os.path.abspath(__file__), "--child", work, name],
                               capture_output=True, text=True, timeout=60)
            bad = json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else {"*": (r.stderr.strip().splitlines() or ["ошибка"])[-1][:200]}
        except subprocess.TimeoutExpired:
            bad = {"*": "таймаут"}
        per[name] = {"ok": not bad, "bad": bad}
        for f in manifest["modules"][name]["funcs"]:
            funcs[f["fn"]] = {"status": f["status"], "ok": f["fn"] not in bad and "*" not in bad}
    by_status = {}
    for v in funcs.values():
        a = by_status.setdefault(v["status"], [0, 0]); a[1] += 1; a[0] += 1 if v["ok"] else 0
    out = {"passed": sum(1 for v in per.values() if v["ok"]), "total": len(per), "tampered": tampered,
           "funcs_ok": sum(1 for v in funcs.values() if v["ok"]), "funcs_total": len(funcs),
           "by_status": by_status, "per": per}
    if "--json" in sys.argv:
        print(json.dumps(out, ensure_ascii=False, indent=1))
    else:
        print(f"модулей {out['passed']} из {out['total']}; функций {out['funcs_ok']} из {out['funcs_total']}; "
              f"по виду дефекта {by_status}; изменено вне src: {tampered or 'нет'}")


main()
'''

# Шаблоны: correct - исходник с {fn}; bugs - id -> (вид, [(что заменить, чем)]); typ - типичные входы, edge - граничные.
TPL = []


def tpl(name, correct, bugs, typ, edge):
    TPL.append({"name": name, "correct": correct, "bugs": bugs, "typ": typ, "edge": edge})


tpl("moving_avg", '''def {fn}(xs, k):
    """Скользящее среднее: для каждого окна из k подряд идущих элементов xs - среднее, округлённое
    до 2 знаков. Длина результата len(xs)-k+1; если k больше len(xs) - пустой список.
    k меньше 1 - ValueError."""
    if k < 1:
        raise ValueError("k")
    return [round(sum(xs[i:i + k]) / k, 2) for i in range(len(xs) - k + 1)]
''', {
    "off": ("visible", [("range(len(xs) - k + 1)", "range(len(xs) - k)")]),
    "nok": ("subtle", [('    if k < 1:\n        raise ValueError("k")\n', "")]),
}, [([[1, 2, 3, 4, 5], 2], {}), ([[4, 8, 6], 3], {}), ([[2, 2, 5, 7], 1], {})],
   [([[1, 2], 5], {}), ([[], 1], {}), ([[1, 2, 3], 0], {}), ([[1, 2, 3], -1], {}), ([[1, 2, 4, 7], 3], {})])

tpl("rle", '''def {fn}(s):
    """Кодирование длин серий: "aaabcc" -> "a3b1c2"; число повторов записывается целиком, без
    ограничения сверху ("a" * 12 -> "a12"). Пустая строка -> пустая строка."""
    out = []
    i = 0
    while i < len(s):
        j = i
        while j < len(s) and s[j] == s[i]:
            j += 1
        out.append(s[i] + str(j - i))
        i = j
    return "".join(out)
''', {
    "last": ("visible", [("        out.append(s[i] + str(j - i))\n        i = j\n", "        if j < len(s):\n            out.append(s[i] + str(j - i))\n        i = j\n")]),
    "cap": ("subtle", [("str(j - i)", "str(min(j - i, 9))")]),
}, [(["aaabcc"], {}), (["abc"], {}), (["zzzz"], {})],
   [([""], {}), (["a" * 12], {}), (["b" * 10 + "c"], {}), (["xyyyz"], {})])

tpl("bsearch_first", '''def {fn}(xs, t):
    """Индекс ПЕРВОГО вхождения t в отсортированном по возрастанию списке xs либо -1."""
    lo, hi = 0, len(xs)
    while lo < hi:
        mid = (lo + hi) // 2
        if xs[mid] < t:
            lo = mid + 1
        else:
            hi = mid
    return lo if lo < len(xs) and xs[lo] == t else -1
''', {
    "le": ("visible", [("if xs[mid] < t:", "if xs[mid] <= t:")]),
    "any": ("subtle", [("        if xs[mid] < t:\n            lo = mid + 1\n        else:\n            hi = mid\n    return lo if lo < len(xs) and xs[lo] == t else -1",
                         "        if xs[mid] == t:\n            return mid\n        if xs[mid] < t:\n            lo = mid + 1\n        else:\n            hi = mid\n    return -1")]),
}, [([[1, 3, 5, 7, 9], 7], {}), ([[1, 3, 5, 7, 9], 9], {}), ([[2, 4, 6], 5], {})],
   [([[], 1], {}), ([[1, 2, 2, 2, 3], 2], {}), ([[5, 5, 5, 5], 5], {}), ([[1, 1, 2, 3, 3, 3, 3], 3], {})])

tpl("merge_intervals", '''def {fn}(iv):
    """Объединяет пересекающиеся и соприкасающиеся ([1, 2] и [2, 3]) отрезки [a, b]. Вход в любом
    порядке; результат - список списков [a, b], отсортированный по началу."""
    out = []
    for a, b in sorted(iv):
        if out and a <= out[-1][1]:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([a, b])
    return out
''', {
    "nosort": ("visible", [("for a, b in sorted(iv):", "for a, b in iv:")]),
    "touch": ("subtle", [("a <= out[-1][1]", "a < out[-1][1]")]),
    "nested": ("subtle", [("out[-1][1] = max(out[-1][1], b)", "out[-1][1] = b")]),
}, [([[[1, 3], [2, 6], [8, 10]]], {}), ([[[5, 7], [1, 2]]], {}), ([[[1, 4], [6, 9]]], {})],
   [([[]], {}), ([[[1, 2], [2, 3]]], {}), ([[[1, 10], [2, 3], [4, 5]]], {}), ([[[3, 4], [1, 2], [2, 3]]], {})])

tpl("parse_kv", '''def {fn}(line):
    """Разбирает "a=1; b = 2;c=x=y" в словарь: пары разделены ';', ключ и значение без пробелов по
    краям, делим по ПЕРВОМУ '='. Пустые фрагменты пропускаются. При повторе ключа побеждает
    последнее значение."""
    res = {}
    for part in line.split(";"):
        if not part.strip():
            continue
        k, v = part.split("=", 1)
        res[k.strip()] = v.strip()
    return res
''', {
    "strip": ("visible", [("res[k.strip()] = v.strip()", "res[k] = v")]),
    "eq": ("subtle", [('part.split("=", 1)', 'part.split("=")')]),
    "empty": ("subtle", [("        if not part.strip():\n            continue\n", "")]),
}, [(["a=1; b = 2"], {}), (["x=hello;y=world"], {}), (["k = v"], {})],
   [(["c=x=y"], {}), (["a=1;;b=2;"], {}), (["a=1;a=2"], {}), ([""], {})])

tpl("roman", '''def {fn}(n):
    """Римская запись целого 1..3999 по вычитающему правилу (4 -> IV, 9 -> IX, 40 -> XL, 90 -> XC,
    400 -> CD, 900 -> CM). Вне диапазона 1..3999 - ValueError."""
    if not 1 <= n <= 3999:
        raise ValueError(n)
    table = [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"),
             (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]
    out = []
    for v, s in table:
        while n >= v:
            out.append(s)
            n -= v
    return "".join(out)
''', {
    "iv": ("visible", [('(5, "V"), (4, "IV"), (1, "I")', '(5, "V"), (1, "I")')]),
    "cm": ("subtle", [('(1000, "M"), (900, "CM"), ', '(1000, "M"), ')]),
    "max": ("subtle", [("1 <= n <= 3999", "1 <= n < 3999")]),
}, [([4], {}), ([14], {}), ([1066], {}), ([58], {})],
   [([900], {}), ([1994], {}), ([3999], {}), ([0], {}), ([4000], {}), ([90], {})])

tpl("flatten", '''def {fn}(xs):
    """Разворачивает вложенные списки любой глубины в один плоский список, порядок сохраняется.
    Строки - значения, внутрь них не заходим."""
    out = []
    for x in xs:
        if isinstance(x, list):
            out.extend({fn}(x))
        else:
            out.append(x)
    return out
''', {
    "one": ("visible", [("out.extend({fn}(x))", "out.extend(x)")]),
    "str": ("subtle", [("isinstance(x, list)", "isinstance(x, (list, str))")]),
}, [([[1, [2, [3, 4]], 5]], {}), ([[[1], [2], [3]]], {}), ([[1, 2, 3]], {})],
   [([[]], {}), ([["ab", ["cd"]]], {}), ([[["x"], "yz", [["w"]]]], {}), ([[[[]], []]], {})])

tpl("dedupe", '''def {fn}(xs):
    """Убирает повторы, оставляя первое вхождение каждого значения; порядок первых вхождений
    сохраняется. Значения 1 и "1" разные."""
    seen = set()
    out = []
    for x in xs:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out
''', {
    "sorted": ("visible", [("    return out\n", "    return sorted(out)\n")]),
    "str": ("subtle", [("    seen = set()\n    out = []\n    for x in xs:\n        if x not in seen:\n            seen.add(x)\n            out.append(x)",
                        "    seen = set()\n    out = []\n    for x in xs:\n        if str(x) not in seen:\n            seen.add(str(x))\n            out.append(x)")]),
}, [([[3, 1, 3, 2, 1]], {}), ([[5, 5, 5]], {}), ([[4, 2, 9]], {})],
   [([[]], {}), ([[1, "1", 1]], {}), ([["b", "a", "b"]], {}), ([[2, 1.0, 1, 2.0]], {})])

tpl("chunk", '''def {fn}(xs, n):
    """Делит список на части по n элементов, последняя может быть короче. Пустой список -> [].
    n меньше 1 - ValueError."""
    if n < 1:
        raise ValueError(n)
    return [xs[i:i + n] for i in range(0, len(xs), n)]
''', {
    "rest": ("visible", [("range(0, len(xs), n)", "range(0, len(xs) - n + 1, n)")]),
    "neg": ("subtle", [("    if n < 1:\n        raise ValueError(n)\n", "")]),
}, [([[1, 2, 3, 4, 5], 2], {}), ([[1, 2, 3, 4], 2], {}), ([[1, 2, 3], 5], {})],
   [([[], 3], {}), ([[1, 2, 3], -1], {}), ([[1, 2, 3], 0], {}), ([[1], 1], {})])

tpl("balanced", '''def {fn}(s):
    """True, если скобки ()[]{} в строке сбалансированы и правильно вложены; остальные символы
    игнорируются. Пустая строка - True. Закрывающая скобка без пары - False."""
    pairs = {")": "(", "]": "[", "}": "{"}
    st = []
    for ch in s:
        if ch in "([{":
            st.append(ch)
        elif ch in pairs:
            if not st or st.pop() != pairs[ch]:
                return False
    return not st
''', {
    "sq": ("visible", [('pairs = {")": "(", "]": "[", "}": "{"}', 'pairs = {")": "(", "}": "{"}')]),
    "empty": ("subtle", [("            if not st or st.pop() != pairs[ch]:", "            if st.pop() != pairs[ch]:")]),
    "left": ("subtle", [("    return not st", "    return True")]),
}, [(["([]{})"], {}), (["(]"], {}), (["a(b)c[d]"], {}), (["{[}]"], {})],
   [([""], {}), ([")"], {}), (["(("], {}), (["())("], {}), (["x"], {})])

tpl("word_freq", '''def {fn}(text):
    """Частоты слов: слова - последовательности букв и цифр, регистр не учитывается (в ответе нижний
    регистр). Результат - список пар [слово, число] по убыванию числа, при равенстве - по слову
    в алфавитном порядке."""
    import re
    counts = {}
    for w in re.findall(r"[A-Za-zА-Яа-я0-9]+", text.lower()):
        counts[w] = counts.get(w, 0) + 1
    return sorted(([w, c] for w, c in counts.items()), key=lambda p: (-p[1], p[0]))
''', {
    "case": ("visible", [("text.lower()", "text")]),
    "tie": ("subtle", [("key=lambda p: (-p[1], p[0])", "key=lambda p: -p[1]")]),
}, [(["one two two three three three"], {}), (["The the THE a"], {}), (["x y x"], {})],
   [([""], {}), (["b a c a b"], {}), (["Hello, hello! World."], {}), (["zz yy xx"], {})])

tpl("transpose", '''def {fn}(m):
    """Транспонирует матрицу (список строк одинаковой длины) в список списков. Матрица может быть
    не квадратной. Пустая матрица - []."""
    if not m:
        return []
    return [[row[j] for row in m] for j in range(len(m[0]))]
''', {
    "tuples": ("visible", [("    return [[row[j] for row in m] for j in range(len(m[0]))]", "    return list(zip(*m))")]),
    "square": ("subtle", [("for j in range(len(m[0]))", "for j in range(len(m))")]),
}, [([[[1, 2], [3, 4]]], {}), ([[[1, 2, 3], [4, 5, 6], [7, 8, 9]]], {}), ([[[7]]], {})],
   [([[]], {}), ([[[1, 2, 3]]], {}), ([[[1], [2], [3]]], {}), ([[[1, 2], [3, 4], [5, 6]]], {}), ([[[1, 2, 3], [4, 5, 6]]], {})])

tpl("gcd_list", '''def {fn}(xs):
    """Наибольший общий делитель списка целых; знак чисел не влияет, результат неотрицателен.
    Пустой список - 0."""
    g = 0
    for x in xs:
        a, b = g, abs(x)
        while b:
            a, b = b, a % b
        g = a
    return g
''', {
    "init": ("visible", [("    g = 0\n", "    g = 1\n")]),
    "abs": ("subtle", [("a, b = g, abs(x)", "a, b = g, x")]),
}, [([[12, 18, 24]], {}), ([[7, 13]], {}), ([[100, 75]], {})],
   [([[]], {}), ([[4, -6]], {}), ([[-8, -12]], {}), ([[0, 5]], {}), ([[0]], {})])

tpl("to_base", '''def {fn}(n, b):
    """Запись неотрицательного целого n в системе счисления b (2..36), цифры 0-9a-z, без ведущих
    нулей; 0 -> "0". b вне 2..36 либо n меньше 0 - ValueError."""
    if not 2 <= b <= 36 or n < 0:
        raise ValueError((n, b))
    if n == 0:
        return "0"
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = []
    while n:
        out.append(digits[n % b])
        n //= b
    return "".join(reversed(out))
''', {
    "rev": ("visible", [('return "".join(reversed(out))', 'return "".join(out)')]),
    "zero": ("subtle", [('    if n == 0:\n        return "0"\n', "")]),
    "b36": ("subtle", [("2 <= b <= 36", "2 <= b < 36")]),
}, [([10, 2], {}), ([255, 16], {}), ([100, 8], {})],
   [([0, 2], {}), ([35, 36], {}), ([5, 36], {}), ([-1, 10], {}), ([5, 1], {}), ([1295, 36], {})])

tpl("max_stack", '''class {cls}:
    """Стек с максимумом. push(x); pop() возвращает снятое значение, на пустом стеке - IndexError;
    max() - наибольшее из лежащих значений, на пустом стеке - None; size() - число элементов.
    Повторяющиеся значения учитываются: после снятия одной из двух равных максимальных
    пятёрок максимум по-прежнему 5."""

    def __init__(self):
        self._items = []
        self._maxes = []

    def push(self, x):
        self._items.append(x)
        if not self._maxes or x >= self._maxes[-1]:
            self._maxes.append(x)

    def pop(self):
        x = self._items.pop()
        if x == self._maxes[-1]:
            self._maxes.pop()
        return x

    def max(self):
        return self._maxes[-1] if self._maxes else None

    def size(self):
        return len(self._items)


def {fn}(ops):
    """Прогоняет операции [["push", x], ["pop"], ["max"], ["size"]] над новым стеком и возвращает
    ответы pop, max и size по порядку; IndexError пустого pop записывается строкой "IndexError"."""
    st = {cls}()
    out = []
    for op in ops:
        try:
            if op[0] == "push":
                st.push(op[1])
            elif op[0] == "pop":
                out.append(st.pop())
            elif op[0] == "max":
                out.append(st.max())
            elif op[0] == "size":
                out.append(st.size())
        except IndexError:
            out.append("IndexError")
    return out
''', {
    "nomaxpop": ("visible", [("        if x == self._maxes[-1]:\n            self._maxes.pop()\n", "")]),
    "dups": ("subtle", [("x >= self._maxes[-1]", "x > self._maxes[-1]")]),
    "emptymax": ("subtle", [("if self._maxes else None", "if self._maxes else 0")]),
}, [([[["push", 3], ["push", 5], ["max"], ["pop"], ["max"]]], {}), ([[["push", 1], ["size"], ["pop"], ["size"]]], {}),
    ([[["push", 2], ["push", 9], ["push", 4], ["max"], ["pop"], ["pop"], ["max"]]], {})],
   [([[["max"]]], {}), ([[["pop"]]], {}), ([[["push", 5], ["push", 5], ["pop"], ["max"]]], {}),
    ([[["push", 2], ["push", 2], ["push", 1], ["pop"], ["pop"], ["max"], ["size"]]], {})])

DOMAIN = ["cart", "feed", "log", "grid", "route", "token", "queue", "batch", "score", "window", "range", "trace"]
STATUS = [("ok", 25), ("visible", 40), ("subtle", 35)]


def apply_bug(correct, repl):
    src = correct
    for old, new in repl:
        old, new = old.replace("{fn}", "{fn}"), new
        assert old in src, old
        src = src.replace(old, new, 1)
    return src


def run_source(src, fn, cls, args, kwargs):
    ns = {}
    exec(src.replace("{fn}", fn).replace("{cls}", cls), ns)  # noqa: S102
    f = ns[fn]
    try:
        return ["val", repr(f(*copy.deepcopy(args), **copy.deepcopy(kwargs)))]
    except Exception as e:  # noqa: BLE001
        return ["exc", type(e).__name__]


def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def main():
    argv = sys.argv[1:]
    out = os.path.abspath(argv[0])
    n = int(argv[argv.index("--modules") + 1])
    seed = int(argv[argv.index("--seed") + 1]) if "--seed" in argv else 7
    visible = argv[argv.index("--visible") + 1] if "--visible" in argv else "weak"
    variant = argv[argv.index("--variant") + 1] if "--variant" in argv else "bugged"
    hidden = out + ".hidden"
    for d in (out, hidden):
        shutil.rmtree(d, ignore_errors=True)
    for sub in ("src", "tests"):
        os.makedirs(os.path.join(out, sub))
    os.makedirs(hidden)
    w = lambda p, s: open(p, "w", encoding="utf-8").write(s)
    w(f"{out}/PROMPT.md", PROMPT); w(f"{out}/run_tests.py", RUN_TESTS); w(f"{hidden}/grade.py", GRADE)
    rng = random.Random(seed)
    cases, modules = {}, {}
    for idx in range(1, n + 1):
        name = f"mod{idx:03d}"
        funcs, parts, ref_parts, vis_cases, hid_cases = [], [], [], [], []
        for k in range(rng.choice([3, 3, 4])):
            t = rng.choice(TPL)
            fn, cls = f"{t['name']}_{rng.choice(DOMAIN)}_{idx:03d}{chr(97 + k)}", f"Stack{idx:03d}{chr(97 + k)}"
            status = rng.choices([s for s, _ in STATUS], [wt for _, wt in STATUS])[0]
            pool = [b for b, (kind, _) in t["bugs"].items() if kind == status]
            if status != "ok" and not pool:
                status = "ok"
            correct = t["correct"]
            bug_id = None
            src = correct
            if status != "ok":
                bug_id = rng.choice(pool)
                src = apply_bug(correct, t["bugs"][bug_id][1])
            typ = copy.deepcopy(t["typ"]); edge = copy.deepcopy(t["edge"])
            # проверка замысла: видимый дефект ловится типичными входами, тонкий - нет, но ловится граничными
            diffs_typ = any(run_source(src, fn, cls, a, kw) != run_source(correct, fn, cls, a, kw) for a, kw in typ)
            diffs_all = any(run_source(src, fn, cls, a, kw) != run_source(correct, fn, cls, a, kw) for a, kw in typ + edge)
            if status == "visible":
                assert diffs_typ, (t["name"], bug_id)
            elif status == "subtle":
                assert not diffs_typ and diffs_all, (t["name"], bug_id, diffs_typ, diffs_all)
            else:
                assert not diffs_all
            for a, kw in typ + edge:
                assert json.loads(json.dumps([a, kw])) == [a, kw], (t["name"], a)
                exp = run_source(correct, fn, cls, a, kw)
                hid_cases.append({"fn": fn, "args": a, "kwargs": kw, "expected": exp})
                if visible == "strong" or (a, kw) in typ:
                    vis_cases.append((fn, a, kw, exp))
            parts.append(src.replace("{fn}", fn).replace("{cls}", cls))
            ref_parts.append(correct.replace("{fn}", fn).replace("{cls}", cls))
            funcs.append({"fn": fn, "template": t["name"], "status": status, "bug": bug_id})
        body = ("\n\n".join(ref_parts) if variant == "ref" else "\n\n".join(parts))
        w(f"{out}/src/{name}.py", f'"""Модуль {name}."""\n\n\n' + body)
        w(f"{hidden}/ref_{name}.py", f'"""Модуль {name}."""\n\n\n' + "\n\n".join(ref_parts))
        w(f"{out}/tests/test_{name}.py", "CASES = " + pprint.pformat(vis_cases, width=100) + "\n")
        cases[name] = hid_cases
        modules[name] = {"funcs": funcs}
    json.dump(cases, open(f"{hidden}/cases.json", "w", encoding="utf-8"), ensure_ascii=False)
    manifest = {"modules": modules, "visible": visible, "hashes": {}}
    for sub in ("tests",):
        for fn in sorted(os.listdir(f"{out}/{sub}")):
            manifest["hashes"][f"{sub}/{fn}"] = sha(f"{out}/{sub}/{fn}")
    manifest["hashes"]["run_tests.py"] = sha(f"{out}/run_tests.py")
    json.dump(manifest, open(f"{hidden}/manifest.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    size = sum(os.path.getsize(f"{out}/src/{f}") for f in os.listdir(f"{out}/src"))
    st = {}
    for m in modules.values():
        for f in m["funcs"]:
            st[f["status"]] = st.get(f["status"], 0) + 1
    print(f"модулей {n}, функций {sum(st.values())} {st}, src {size} байт, видимые тесты {visible}, вариант {variant}, скрытая директория {hidden}")


main()
