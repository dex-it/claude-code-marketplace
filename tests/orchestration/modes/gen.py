#!/usr/bin/env python3
"""Фикстура экзамена способов работы: рабочее дерево с пакетом плана и двумя корпусами модулей.

    python3 gen.py <каталог>

Дерево строится вне репозитория (исполнитель не должен видеть грейдер). Статические файлы берутся
из fixture/, два корпуса по 24 модуля (src/p - для N2, src/k - для N7; по ~23 тыс. токенов каждый)
порождаются детерминированно (seed 101 и 202), чтобы обзор модуля через бриф не умещался в страницу.
Проверка N7 хранит эталон хэшами: чтение checks/n7.py ответа не выдаёт.
"""
import hashlib, os, random, shutil, sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
PLANNER = os.path.join(HERE, '../../../plugins/skills/dex-skill-orchestration-planner/skills/orchestration-planner')
dst = os.path.abspath(sys.argv[1])
if os.path.exists(dst):
    shutil.rmtree(dst)
shutil.copytree(os.path.join(HERE, 'fixture'), dst)

# *.log в .gitignore: журнал хранится как app.log.txt
os.rename(os.path.join(dst, 'logs/app.log.txt'), os.path.join(dst, 'logs/app.log'))

# Раздел 6 PLAN.md - копия таблицы категорий (SKILL.md планировщика) и осей, переопределений и правил
# триажа (routing.md), как в настоящем пакете: оркестратор маршрутизирует новые задачи по ней.
skill = open(os.path.join(PLANNER, 'SKILL.md'), encoding='utf-8').read()
routing = open(os.path.join(PLANNER, 'references/routing.md'), encoding='utf-8').read()
cat_table = skill[skill.index('| Категория | Модель |'):].split('\n\n')[0]
axes = routing[routing.index('## Оси оценки трудности (0-2)'):routing.index('## Цены')]
plan_path = os.path.join(dst, 'pack/PLAN.md')
plan = open(plan_path, encoding='utf-8').read()
open(plan_path, 'w', encoding='utf-8').write(
    plan.replace('{{ROUTING}}', '### Категории\n\n' + cat_table + '\n\n### ' + axes[3:].replace('\n## ', '\n### ').rstrip()))


def w(path, text):
    p = os.path.join(dst, path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(text)


FAM = ['разбор', 'форматирование', 'кэш', 'устойчивость', 'проверка', 'планирование', 'сериализация', 'маршрутизация']
NOUNS = ['invoice', 'shipment', 'ticket', 'metric', 'account', 'order', 'device', 'policy', 'session', 'catalog', 'payment', 'report']

def body(fam, noun, rnd):
    n = noun; N = noun.capitalize()
    if fam == 'разбор':
        return f'''"""Разбор строк {n} из текстового журнала в структуры."""
import re

FIELD_RE = re.compile(r"(\\w+)=([^;]*)")


def tokenize_{n}(line):
    """Разбить строку {n} на пары ключ=значение."""
    return FIELD_RE.findall(line)


def parse_{n}_line(line):
    """Разобрать одну строку {n}; пропускает пустые значения."""
    out = {{}}
    for key, value in tokenize_{n}(line):
        if value != "":
            out[key] = value
    return out


def parse_{n}_block(text):
    """Разобрать многострочный блок {n}, игнорируя комментарии."""
    rows = []
    for raw in text.splitlines():
        if not raw.strip() or raw.startswith("#"):
            continue
        rows.append(parse_{n}_line(raw))
    return rows


def split_{n}_header(text):
    """Отделить заголовок {n} от тела по первой пустой строке."""
    head, _, rest = text.partition("\\n\\n")
    return parse_{n}_line(head.replace("\\n", ";")), rest
'''
    if fam == 'форматирование':
        return f'''"""Человекочитаемое представление {n} для писем и отчётов."""


def pad_{n}_id(value, width=8):
    """Дополнить идентификатор {n} нулями слева."""
    return str(value).rjust(width, "0")


def format_{n}_amount(cents, currency="RUB"):
    """Показать сумму {n} в виде 12 345.67 RUB."""
    whole, frac = divmod(int(cents), 100)
    return f"{{whole:,}}".replace(",", " ") + f".{{frac:02d}} {{currency}}"


def format_{n}_summary(rec):
    """Собрать одну строку-сводку по {n}."""
    return f"{{pad_{n}_id(rec['id'])}}: {{rec.get('title', '-')}} ({{format_{n}_amount(rec.get('cents', 0))}})"


def humanize_{n}_age(seconds):
    """Возраст {n} словами: 5 мин, 2 ч, 3 дн."""
    for unit, size in (("дн", 86400), ("ч", 3600), ("мин", 60)):
        if seconds >= size:
            return f"{{seconds // size}} {{unit}}"
    return f"{{seconds}} с"
'''
    if fam == 'кэш':
        return f'''"""Кэш объектов {n} с вытеснением давно не использованных."""
import time
from collections import OrderedDict


class {N}Cache:
    """LRU-кэш {n} со сроком жизни записей."""

    def __init__(self, capacity=128, ttl=60.0):
        self.capacity = capacity
        self.ttl = ttl
        self._data = OrderedDict()

    def get(self, key):
        item = self._data.get(key)
        if item is None:
            return None
        value, stamp = item
        if time.time() - stamp > self.ttl:
            del self._data[key]
            return None
        self._data.move_to_end(key)
        return value

    def put(self, key, value):
        self._data[key] = (value, time.time())
        self._data.move_to_end(key)
        while len(self._data) > self.capacity:
            self._data.popitem(last=False)

    def invalidate_{n}(self, key):
        self._data.pop(key, None)

    def stats(self):
        return {{"size": len(self._data), "capacity": self.capacity}}
'''
    if fam == 'устойчивость':
        return f'''"""Повторы и предохранитель для вызовов сервиса {n}."""
import time


class {N}CircuitOpen(Exception):
    pass


def retry_{n}(fn, attempts=3, delay=0.5, factor=2.0):
    """Повторить вызов {n} с растущей паузой."""
    last = None
    for i in range(attempts):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(delay * (factor ** i))
    raise last


class {N}Breaker:
    """Размыкает цепь после серии ошибок и пробует снова через паузу."""

    def __init__(self, limit=5, cooldown=30.0):
        self.limit = limit
        self.cooldown = cooldown
        self.failures = 0
        self.opened_at = None

    def call(self, fn):
        if self.opened_at and time.time() - self.opened_at < self.cooldown:
            raise {N}CircuitOpen("цепь разомкнута")
        try:
            result = fn()
        except Exception:
            self.failures += 1
            if self.failures >= self.limit:
                self.opened_at = time.time()
            raise
        self.failures = 0
        self.opened_at = None
        return result
'''
    if fam == 'проверка':
        return f'''"""Проверка записей {n} на полноту и допустимые значения."""

REQUIRED = ("id", "title", "owner")
ALLOWED_STATUS = {{"new", "active", "closed"}}


def validate_{n}(rec):
    """Вернуть список ошибок записи {n}; пустой список - запись верна."""
    errors = []
    for field in REQUIRED:
        if not rec.get(field):
            errors.append(f"нет поля {{field}}")
    if rec.get("status") not in ALLOWED_STATUS:
        errors.append("недопустимый статус")
    if not isinstance(rec.get("cents", 0), int) or rec.get("cents", 0) < 0:
        errors.append("сумма должна быть неотрицательным целым")
    return errors


def validate_{n}_batch(rows):
    """Проверить пачку записей {n}; ключ - позиция, значение - ошибки."""
    return {{i: errs for i, rec in enumerate(rows) if (errs := validate_{n}(rec))}}


def assert_valid_{n}(rec):
    errs = validate_{n}(rec)
    if errs:
        raise ValueError("; ".join(errs))
    return rec
'''
    if fam == 'планирование':
        return f'''"""Планировщик отложенных задач по {n}."""
import heapq
import itertools

_counter = itertools.count()


class {N}Scheduler:
    """Очередь задач {n}, упорядоченная по времени запуска и приоритету."""

    def __init__(self):
        self._heap = []

    def schedule_{n}(self, run_at, priority, task):
        heapq.heappush(self._heap, (run_at, priority, next(_counter), task))

    def due_{n}(self, now):
        """Достать все задачи {n}, время которых наступило."""
        ready = []
        while self._heap and self._heap[0][0] <= now:
            ready.append(heapq.heappop(self._heap)[3])
        return ready

    def next_run_{n}(self):
        return self._heap[0][0] if self._heap else None

    def reschedule_{n}(self, task, delay, now):
        self.schedule_{n}(now + delay, 5, task)
'''
    if fam == 'сериализация':
        return f'''"""Сохранение и чтение {n} в JSON с версией формата."""
import json

FORMAT_VERSION = 2


def to_json_{n}(rec):
    """Сериализовать {n} в строку JSON с полем версии."""
    return json.dumps({{"v": FORMAT_VERSION, "data": rec}}, ensure_ascii=False, sort_keys=True)


def from_json_{n}(text):
    """Прочитать {n} из JSON; старые версии приводятся к текущей."""
    doc = json.loads(text)
    version = doc.get("v", 1)
    data = doc["data"]
    if version < 2:
        data = _upgrade_v1_{n}(data)
    return data


def _upgrade_v1_{n}(data):
    out = dict(data)
    if "price" in out:
        out["cents"] = int(round(out.pop("price") * 100))
    return out


def dump_many_{n}(rows):
    return "\\n".join(to_json_{n}(r) for r in rows)
'''
    return f'''"""Маршрутизация запросов к обработчикам {n} по пути."""

ROUTES = []


def route_{n}(prefix, handler):
    """Зарегистрировать обработчик {n} для префикса пути."""
    ROUTES.append((prefix, handler))
    ROUTES.sort(key=lambda r: -len(r[0]))


def resolve_{n}(path):
    """Найти обработчик {n} для пути: побеждает самый длинный префикс."""
    for prefix, handler in ROUTES:
        if path.startswith(prefix):
            return handler
    return None


def dispatch_{n}(request):
    handler = resolve_{n}(request["path"])
    if handler is None:
        return {{"status": 404, "body": "не найдено"}}
    return handler(request)


def route_table_{n}():
    return [prefix for prefix, _ in ROUTES]
'''

def corpus(prefix, folder, seed):
    """24 модуля: 8 семейств x 3 предметных слова; к основному телу добавлены три чужих по тому же семейству."""
    rnd = random.Random(seed)
    truth = {}
    items = [(f, n) for f in FAM for n in rnd.sample(NOUNS, 3)]
    rnd.shuffle(items)
    for i, (fam, noun) in enumerate(items, 1):
        name = f'{prefix}{i:02d}'
        extra = rnd.sample([x for x in NOUNS if x != noun], 3)
        parts = [body(fam, noun, rnd)] + [body(fam, x, rnd).split('\n', 1)[1] for x in extra]
        w(f'{folder}/{name}.py', '\n\n'.join(parts))
        truth[name] = fam
    return truth


corpus('c', 'src/p', 101)
t7 = corpus('d', 'src/k', 202)

w('checks/n2.py', '''#!/usr/bin/env python3
import re, sys
sys.dont_write_bytecode = True
bad = []
for i in range(1, 25):
    n = f'c{i:02d}'
    try:
        txt = open(f'out/p/{n}.txt', encoding='utf-8').read().strip()
    except OSError:
        bad.append(f'{n}: нет файла')
        continue
    src = open(f'src/p/{n}.py', encoding='utf-8').read()
    flat = {x for t in re.findall(r'def (\\w+)|class (\\w+)', src) for x in t if x}
    if not (20 <= len(txt) <= 300) or txt.count('\\n') > 0:
        bad.append(f'{n}: длина/строки')
    elif not any(x.lower() in txt.lower() for x in flat if not x.startswith('_')):
        bad.append(f'{n}: нет имени из модуля')
print('OK' if not bad else 'FAIL ' + '; '.join(bad[:6]))
sys.exit(1 if bad else 0)
''')
digest = {n: hashlib.sha256(f'{n}:{fam}'.encode()).hexdigest() for n, fam in t7.items()}
w('checks/n7.py', '''#!/usr/bin/env python3
import hashlib, sys
sys.dont_write_bytecode = True
FAM = %r
digest = %r
ok = 0
bad = []
for n, h in digest.items():
    try:
        first = open(f'out/cat/{n}.txt', encoding='utf-8').read().strip().lower().split('\\n')[0].strip()
    except OSError:
        bad.append(f'{n}: нет файла')
        continue
    found = [f for f in FAM if f in first]
    if len(found) == 1 and hashlib.sha256(f'{n}:{found[0]}'.encode()).hexdigest() == h:
        ok += 1
    else:
        bad.append(f'{n}: категория не та')
print(('OK' if ok >= 22 else 'FAIL') + f' {ok}/24 ' + '; '.join(bad[:4]))
sys.exit(0 if ok >= 22 else 1)
''' % (FAM, digest))
for f in ('checks/n2.py', 'checks/n7.py', 'pack/checks/t1.py'):
    os.chmod(os.path.join(dst, f), 0o755)
os.makedirs(os.path.join(dst, 'out/p'), exist_ok=True)
os.makedirs(os.path.join(dst, 'out/cat'), exist_ok=True)
print(dst)
