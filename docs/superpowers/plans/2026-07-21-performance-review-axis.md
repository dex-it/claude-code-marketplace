# Нейтральная ось производительности в ревью diff'а Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать язык-нейтральный `dex-skill-performance-review` (ловушки ревью перфа в diff) и подключить его в блок «всегда» трёх ревьюеров ревью-контура, замкнув бандлы.

**Architecture:** Новый trap-skill - калька архитектуры `dex-skill-owasp-security` (H2-категории, H3-грабли «Плохо/Правильно/Почему», чек-лист). Подключается императивно (Skill tool) в фазе Deep Scan у mr-reviewer / self-reviewer / mr-check-reviewer как безусловно грузимый тематический skill. Бандлы, везущие этих ревьюеров, замыкаются по `includes[]`.

**Tech Stack:** Markdown-артефакты плагин-маркетплейса; валидаторы `tools/validate-{skill,bundle}.js`.

## Global Constraints

- Пунктуация ASCII: `-` вместо `—`, `->` вместо `→`, `<=`/`>=`/`!=` вместо `≤`/`≥`/`≠`, `...` вместо `…`. НЕ трогать box-drawing/эмодзи/inline-code-примеры.
- Skill-ссылки полной формой `dex-skill-performance-review:performance-review` (не голым именем плагина).
- Версии в паре: `plugin.json` И `marketplace.json` одновременно.
- Тело SKILL.md - для LLM: сухо, механизм/условие/исход, без воды. Прогон `optimize-for-llm` на готовом теле.
- Каждый техфакт в «Правильно» - под fact-check (анти-паттерн №11): context7 -> WebSearch fallback; уход от сверки - явный статус, не молчание. Грабля обобщена: ни одного имени конкретного проекта/Entity.
- Skill язык-нейтральный: примеры-имена API (`Include`/`asyncio.gather`/`Promise.all`) допустимы как иллюстрация, но правило читается как принцип без стека; НЕ `dex-skill-<стек>-*`.
- Размер SKILL.md: до 250 строк (6 осей + шапка принципов; потолок trap-skill, костяк не дробится). `description` <= 750 символов.
- Стековые хвосты (`ArrayPool`/`Span`/`[LibraryImport]`, GIL/NumPy, `SharedArrayBuffer`/React-memo) - сноской `>`, НЕ H3 тела. React-грабли (key/ре-рендеры/useMemo) исключены (UI-специфика).
- Пограничные грабли берутся только перф-гранью, дом смежного домена назван сноской: ReDoS-атака -> security, лог что/куда -> observability, тайм-аут/backoff -> distributed-resilience.
- Грабли «часто не видно в diff» (SELECT без индекса, деградация локов, крупный payload, hot path) - НЕ безусловные H3: либо условная строка чек-листа с оговоркой «severity зависит от контекста», либо исключены.

---

### Task 1: Создать skill `dex-skill-performance-review`

**Files:**
- Create: `plugins/skills/dex-skill-performance-review/.claude-plugin/plugin.json`
- Create: `plugins/skills/dex-skill-performance-review/skills/performance-review/SKILL.md`

**Interfaces:**
- Produces: имя плагина `dex-skill-performance-review`; skill-путь `dex-skill-performance-review:performance-review` (потребляют Tasks 2-4).

Эталон формата (читать перед написанием): `plugins/skills/dex-skill-owasp-security/skills/owasp-security/SKILL.md` - H2-категория, под ней H3-грабли строго 3 строки «Плохо:/Правильно:/Почему:», в конце `## Чек-лист ревью` bullet-списком.

- [ ] **Step 1: plugin.json**

Записать в `plugins/skills/dex-skill-performance-review/.claude-plugin/plugin.json`:

```json
{
  "name": "dex-skill-performance-review",
  "version": "1.0.0",
  "description": "Ловушки ревью производительности в diff - доступ к данным, I/O round-trips, async/конкурентность, материализация, память/строки, натив-граница"
}
```

- [ ] **Step 2: SKILL.md - каркас frontmatter + шапка принципов + 6 категорий**

Frontmatter (keywords по симптомам ревью, не по терминам ловушек):

```yaml
---
name: performance-review
description: Ловушки производительности при ревью diff - доступ к данным, I/O, асинхронность и конкурентность, материализация, память и строки, натив-граница. Активируется при N+1, query in loop, await in loop, sync over async, blocking async, materialization, ToList before filter, hot path allocation, missing pagination, overfetch, socket exhaustion, readAllText vs stream, string concat loop, string builder, serialization in loop, ReDoS, performance review, slow query review
---
```

H1 `# Производительность - ловушки ревью diff'а`.

Затем **шапка «4 сквозных принципа»** (4 строки, рамка вывода - как сквозной чек-лист owasp; оси = где искать, принципы = что не так):
1. Не делай в цикле то, что делается разом (round-trip, запрос, вызов границы, аллокация, компиляция regex, захват лока - loop-invariant выносится из цикла).
2. Не тащи в память больше/раньше, чем нужно (overfetch, весь файл/payload, жадная материализация, unbounded cache).
3. Работай со ссылкой/потоком, не с копией (стрим vs буфер, срез vs копия, пул vs new).
4. Переноси работу туда, где дешевле (фильтр/агрегация в источник, независимое в параллель, дорогое за проверку).

Затем **6 H2-категорий**. Под каждой H2 - грабли H3 в формате owasp (Плохо/Правильно/Почему, 3-5 строк). Категории и минимальный состав (полный реестр - в спеке `docs/superpowers/specs/2026-07-21-performance-review-axis-design.md`, раздел «Категории (H2)»):

- `## Доступ к данным` - N+1 (навигация/запрос в цикле по коллекции); unbounded result set (нет пагинации); overfetch колонок (нет проекции); exists-vs-count; фильтр/агрегация в память вместо источника.
- `## I/O: как ходим к ресурсу` - НЕ «сколько данных» (overfetch выше), а физика: запись/запрос в цикле вместо батча; клиент/соединение/хендл на итерацию (socket exhaustion: короткоживущий HTTP-клиент per-request); весь payload/файл в память вместо стрима (ReadAllText/resp.content/readFileSync vs потоковое чтение); транзакция вокруг внешнего I/O.
- `## Асинхронность и конкурентность` - await-in-loop независимых -> параллель (флагман); sync-over-async; лок вокруг тяжёлой/IO-операции (сужай); тяжёлое на потоке запроса **с развилкой I/O-bound -> async / CPU-bound -> в фон, не async** (`Task.Run` вокруг CPU в хендлере - антипаттерн); пул вместо ручных потоков per-item. Оговорка JS: однопоточный event loop - часть N/A.
- `## Материализация и коллекции` - needless materialization (list(gen)/ToList ради len/any); повторный обход lazy-источника; поиск в списке O(n) в цикле -> хеш-структура (структурный O(n^2)); повторная итерация исчерпанного потока; (де)сериализация/маппинг в цикле (JSON/DTO per-item, options без переиспользования, маппер-в-память вместо проекции).
- `## Память, строки, массивы` - аллокация инвариантного в горячем цикле; удержание крупного объекта/подписки (граница жизни); срез/копия крупной структуры вместо ссылки; конкатенация строк в цикле O(n^2) (билдер/join); regex создаётся/компилируется в цикле (частный случай принципа 1); ReDoS/catastrophic backtracking (перф-грань: экспонента времени, НЕ «вредоносный ввод» - см. сноску); unbounded cache без границы.
- `## Граница натив<->управляемый код` - одна H3 (не размножать): минимизируй число пересечений границы, батчируй данные, не маршалируй/копируй per-call. Конкретика (P/Invoke, NumPy-векторизация, N-API/WASM) - стековые сноски.

В конце - `## Чек-лист ревью` bullet-списком (по одной строке на граблю, как в owasp). Сюда же грабля принципа 4 **лог на горячем пути** (интерполяция дорогого аргумента лога до проверки уровня - перф-грань, не «что логировать», см. сноску) и **условные** строки «часто не видно в diff» с оговоркой «severity зависит от контекста» (SELECT без индекса - только если в PR есть и миграция колонки, и горячий фильтр по ней).

Сноски-разграничители (в теле, отдельными строками `>` - ссылки для человека, НЕ загрузка skill):

```
> Runtime-профилирование живого процесса (perf record, FlameGraph) - dex-skill-perf-profiling.
> .NET-специфичная диагностика (EF-запросы, APM, память) - агент dotnet-performance-analyst.
> Тайм-аут/ретрай/backoff/circuit breaker - dex-skill-distributed-resilience.
> ReDoS как вектор атаки (вредоносный ввод, DoS) - security-reviewer/owasp; здесь только перф-грань.
> Что и куда логировать (уровни, PII, структурность) - dex-skill-observability; здесь только лишняя работа лога.
```

- [ ] **Step 3: Наполнить грабли + fact-check КАЖДОЙ строки «Правильно»**

Для каждой H3-грабли написать 3 строки. Перед фиксацией «Правильно» - сверка (Global Constraints: fact-check):
- грабля - реальная и неочевидная для ревьюера diff'а (не банальность, которую модель знает без skill); банальная - убрать;
- «Правильно» описывает приём (имя API/условие/структуру), не развёрнутый сниппет;
- где «Правильно» опирается на поведение конкретного API/языка - сверить с текущей версией (context7 -> WebSearch); неверифицируемое пометить статусом, не выдавать за факт;
- пример-иллюстрация нейтрален по стеку (или явно помечен как пример одного стека), правило читается без него.

**Обязательный fact-check оговорок из спеки (эти формулировки НЕ писать наивно):**
- .NET `lock` + `await` в одном блоке НЕ компилируется - грабля «лок вокруг IO» через `Monitor`/синхронный IO под локом, не `await`.
- Boxing при интерполяции `$"{i}"` устранён для многих случаев с .NET 6 - в ядро идёт «не аллоцируй инвариантное в цикле», не boxing-конкретика.
- `str +=`/`s +=` в цикле имеют движковые оптимизации (V8 rope, CPython in-place) - квадратичность не гарантирована; правило «join/builder» валидно, формулировать «паттерн хрупкий», не «всегда O(n^2)».
- Python `re` имеет внутренний кэш - «не полагайся на кэш, компилируй явно», не «re.match всегда пересоздаёт».
- DBAPI `executemany` НЕ гарантирует один INSERT (драйвер-зависимо) - не «executemany = один запрос»; истинный батч в Postgres - execute_values/execute_batch.
- `HttpClient` per-request - проблема «короткоживущий хендлер плодит сокеты в TIME_WAIT», не «нельзя dispose».
- CPU-vs-IO развилка - сверить поведение `Task.Run` в ASP.NET и thread-pool starvation.
- ReDoS - сверить, что грабля про catastrophic backtracking (вложенные квантификаторы), формулировать нейтрально.

- [ ] **Step 4: optimize-for-llm на теле**

Прогнать `optimize-for-llm` на готовом SKILL.md: срезать воду/повтор, оставить механизм/условие/исход. Нормативную силу (реестр граблей, «Почему») не сокращать.

- [ ] **Step 5: Валидация skill**

Run: `npm run validate:skills`
Expected: 0 ошибок. Проверить вручную: размер до 250 строк (6 осей + шапка принципов; костяк не дробится), `description` <= 750, ASCII-пунктуация, полная форма skill-ссылок отсутствует внутри тела как загрузка (только сноски `>`).

- [ ] **Step 6: Commit**

```bash
git add plugins/skills/dex-skill-performance-review/
git commit -m "feat(perf-review): нейтральный skill ловушек производительности в ревью diff"
```

---

### Task 2: Подключить skill к mr-reviewer + bump

**Files:**
- Modify: `plugins/specialists/review/dex-mr-reviewer/agents/mr-reviewer.md:100`
- Modify: `plugins/specialists/review/dex-mr-reviewer/.claude-plugin/plugin.json` (1.8.0 -> 1.9.0)

**Interfaces:**
- Consumes: `dex-skill-performance-review:performance-review` (Task 1).

- [ ] **Step 1: Добавить skill в блок «Всегда»**

Строка 100 сейчас:
```
- Всегда - `dex-skill-solid:solid`, `dex-skill-owasp-security:owasp-security`, `dex-skill-testability:testability`, `dex-skill-no-loose-ends:no-loose-ends`
```
Стало (добавить в конец перечня):
```
- Всегда - `dex-skill-solid:solid`, `dex-skill-owasp-security:owasp-security`, `dex-skill-testability:testability`, `dex-skill-no-loose-ends:no-loose-ends`, `dex-skill-performance-review:performance-review`
```

- [ ] **Step 2: Bump plugin.json**

`plugins/specialists/review/dex-mr-reviewer/.claude-plugin/plugin.json`: `"version": "1.8.0"` -> `"version": "1.9.0"`.

- [ ] **Step 3: Commit**

```bash
git add plugins/specialists/review/dex-mr-reviewer/
git commit -m "feat(mr-reviewer): грузить performance-review в Deep Scan"
```

---

### Task 3: Подключить skill к self-reviewer + bump

**Files:**
- Modify: `plugins/specialists/review/dex-self-reviewer/agents/self-reviewer.md:85`
- Modify: `plugins/specialists/review/dex-self-reviewer/.claude-plugin/plugin.json` (1.8.0 -> 1.9.0)

- [ ] **Step 1: Добавить skill в «всегда»**

В строке 85 фрагмент:
```
всегда `dex-skill-solid:solid`, `dex-skill-owasp-security:owasp-security`, `dex-skill-testability:testability`, `dex-skill-no-loose-ends:no-loose-ends` (ядро фокуса loose-ends);
```
Стало (добавить skill перед `(ядро фокуса loose-ends)` - т.е. в перечень «всегда»):
```
всегда `dex-skill-solid:solid`, `dex-skill-owasp-security:owasp-security`, `dex-skill-testability:testability`, `dex-skill-no-loose-ends:no-loose-ends` (ядро фокуса loose-ends), `dex-skill-performance-review:performance-review`;
```

- [ ] **Step 2: Bump plugin.json**

`1.8.0` -> `1.9.0`.

- [ ] **Step 3: Commit**

```bash
git add plugins/specialists/review/dex-self-reviewer/
git commit -m "feat(self-reviewer): грузить performance-review в Deep Scan"
```

---

### Task 4: Подключить skill к mr-check-reviewer + bump

**Files:**
- Modify: `plugins/specialists/review/dex-mr-check-reviewer/agents/mr-check-reviewer.md:87`
- Modify: `plugins/specialists/review/dex-mr-check-reviewer/.claude-plugin/plugin.json` (1.7.0 -> 1.8.0)

- [ ] **Step 1: Добавить skill в «всегда»**

В строке 87 фрагмент:
```
всегда `dex-skill-solid:solid`, `dex-skill-owasp-security:owasp-security`, `dex-skill-testability:testability`, `dex-skill-no-loose-ends:no-loose-ends`;
```
Стало:
```
всегда `dex-skill-solid:solid`, `dex-skill-owasp-security:owasp-security`, `dex-skill-testability:testability`, `dex-skill-no-loose-ends:no-loose-ends`, `dex-skill-performance-review:performance-review`;
```

- [ ] **Step 2: Bump plugin.json**

`1.7.0` -> `1.8.0`.

- [ ] **Step 3: Commit**

```bash
git add plugins/specialists/review/dex-mr-check-reviewer/
git commit -m "feat(mr-check-reviewer): грузить performance-review в Deep Scan"
```

---

### Task 5: Замкнуть бандлы по новому skill + bump

**Files:**
- Modify: `plugins/bundles/dex-bundle-code-review/bundle.json` (+ plugin.json 1.10.0 -> 1.11.0)
- Modify: `plugins/bundles/dex-bundle-dotnet-developer/bundle.json` (+ plugin.json 2.7.0 -> 2.8.0)
- Modify: `plugins/bundles/dex-bundle-dotnet-fullstack/bundle.json` (+ plugin.json 2.7.0 -> 2.8.0)

**Interfaces:**
- Consumes: имя `dex-skill-performance-review` (Task 1). Правило `bundle-not-closed`: каждый не-by-stack skill, грузимый агентом бандла, обязан быть в `includes[]`. Все три бандла везут `dex-mr-reviewer` (грузит skill в Task 2); code-review везёт также `dex-self-reviewer` и `dex-mr-check-reviewer`; dotnet-* везут `dex-self-reviewer`. Значит skill нужен во всех трёх.

- [ ] **Step 1: Добавить skill в includes[] трёх бандлов**

В каждый из трёх `bundle.json` добавить `"dex-skill-performance-review"` в массив `includes` (рядом с прочими `dex-skill-*`, порядок не критичен - валидатор по членству).

- [ ] **Step 2: Bump plugin.json бандлов**

- `dex-bundle-code-review`: `1.10.0` -> `1.11.0`
- `dex-bundle-dotnet-developer`: `2.7.0` -> `2.8.0`
- `dex-bundle-dotnet-fullstack`: `2.7.0` -> `2.8.0`

- [ ] **Step 3: Валидация бандлов**

Run: `npm run validate:bundles`
Expected: правило `bundle-not-closed` замыкания по трём бандлам структурно выполнено (skill в каждом includes[]). Ошибка `skill-reference-unknown` для `dex-skill-performance-review` ОЖИДАЕМА до Task 6 (skill не в marketplace.json) - не дефект задачи. Полный зелёный - критерий Task 6.

- [ ] **Step 4: Commit**

```bash
git add plugins/bundles/dex-bundle-code-review/ plugins/bundles/dex-bundle-dotnet-developer/ plugins/bundles/dex-bundle-dotnet-fullstack/
git commit -m "feat(bundles): замкнуть code-review/dotnet-developer/dotnet-fullstack по performance-review"
```

---

### Task 6: Синхронизировать marketplace.json (записи + версии + каталог)

**Files:**
- Modify: `.claude-plugin/marketplace.json`

**Interfaces:**
- Consumes: версии из Tasks 1-5 (skill 1.0.0; mr-reviewer 1.9.0; self-reviewer 1.9.0; mr-check-reviewer 1.8.0; code-review 1.11.0; dotnet-developer 2.8.0; dotnet-fullstack 2.8.0).

- [ ] **Step 1: Добавить запись нового плагина**

Добавить в каталог `plugins[]` запись `dex-skill-performance-review` версии `1.0.0` (по образцу соседних skill-записей: source-путь `plugins/skills/dex-skill-performance-review`, description из plugin.json).

- [ ] **Step 2: Синхронизировать версии 6 изменённых плагинов**

Привести версии в `marketplace.json` к plugin.json: `dex-mr-reviewer` 1.9.0, `dex-self-reviewer` 1.9.0, `dex-mr-check-reviewer` 1.8.0, `dex-bundle-code-review` 1.11.0, `dex-bundle-dotnet-developer` 2.8.0, `dex-bundle-dotnet-fullstack` 2.8.0.

- [ ] **Step 3: Bump версии каталога**

Верхнеуровневое `"version"`: `5.32.0` -> `5.33.0` (добавлен плагин).

- [ ] **Step 4: Полная валидация**

Run: `npm run validate`
Expected: 0 ошибок по всем осям (agents/skills/commands/bundles). Проверить: версии skill+6 плагинов сходятся между plugin.json и marketplace.json; каталог 5.33.0.

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin/marketplace.json
git commit -m "feat(catalog): performance-review в каталог + sync версий, каталог 5.33.0"
```
