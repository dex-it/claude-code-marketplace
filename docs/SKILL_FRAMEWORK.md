# Skill Framework

Методичка для создания skills в Claude Code marketplace. Используется человеком или Claude при работе над плагинами — не загружается в runtime при обычной работе skill.

Документ — параллель к [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md). Там — как собирать агентов из фаз. ��десь — как писать skills, которые эти агенты загружают.

## Глоссарий

Термины, используемые в документе.

| Термин                        | Определение                                                                                                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Skill**                     | Markdown-файл с frontmatter в `plugins/skills/dex-skill-X/skills/X/SKILL.md`, содержащий специализированные знания — ловушки, grabli, anti-patterns для конкретной технологии или темы. |
| **Ловушка**                   | Неочевидное поведение или типичная ошибка, которую разработчик легко допускает. Основная единица содержания skill.                                                                      |
| **Anti-pattern**              | Распространённое «плохое решение», которое выглядит разумно на первый взгляд, но приводит к проблемам. Синоним ловушки в формальном контексте.                                          |
| **Trigger / Активация**       | Ключевые слова в `description` skill, по которым Claude Code автоматически загружает его в контекст через semantic matching.                                                            |
| **Semantic activation**       | Механизм загрузки skill: Claude Code сопоставляет контекст разговора с `description` всех skill и подгружает наиболее релевантные.                                                      |
| **Pointer, не код**           | Принцип: в примерах «правильно» указываем **имя API или условие**, а не развёрнутый code snippet. «Указываем путь, не прокладываем дорогу».                                             |
| **Почему**                    | Обязательная часть каждой ловушки: объяснение, из-за чего возникает проблема и почему альтернатива работает. Без «почему» ловушка превращается в карго-культ.                           |
| **Категория ловушек**         | Группировка ловушек внутри skill по общему признаку: Queries, Concurrency, Resources, Security, ...                                                                                     |
| **Stack-агностичность**       | Свойство skill не привязываться к одному конкретному стеку, когда тема применима шире (logging — это не только Serilog, это любой structured logging).                                  |
| **Документация API**          | Объяснение того, как работает технология, её синтаксис, базовые концепции. Это то, что Claude **уже знает** — и что НЕЛЬЗЯ писать в skill.                                              |

## Почему нужен фреймворк для skills

В маркетплейсе 42 skill. Без единых правил каждый автор может скатиться в одно из двух:

1. **Скопировать документацию технологии** в skill, раздувая файл до 500+ строк. Файл не читают, контекст Claude забит ненужным.
2. **Написать слишком общо** — без конкретики, без «почему», без примеров. Claude не получает ничего нового поверх своих базовых знаний.

Фреймворк фиксирует **что такое skill по определению**, **что в нём должно быть**, **что запрещено**, и **как проверить качество**. Это инструмент для авторов: новые skill пишутся по правилам, существующие проверяются валидатором.

## Ключевой принцип: skill — это ловушки, не документация

Claude **знает** как работает Entity Framework Core, как выглядит PyTorch training loop, какой синтаксис у Dockerfile, как правильно писать React-компонент. Всё это есть в его training data. Объяснять базовые концепции или синтаксис в skill — значит дублировать то, что и так доступно, и при этом тратить контекст впустую.

Skill нужен для того, что Claude **не знает или часто забывает**:

- **Ловушки**, которые срабатывают незаметно (N+1 без ошибки, только медленно)
- **Неочевидное поведение** API, которое противоречит интуиции (`AddAsync` делает лишний roundtrip в БД)
- **Стандартные ошибки**, которые повторяют из проекта в проект (captive dependency, async void)
- **Trade-off'ы**, где выбор неочевиден и зависит от контекста (`AsSplitQuery` эффективен для списка, но не для single entity)
- **Критические правила**, нарушение которых ведёт к багам в проде (soft-delete + cascade FK = потеря данных)

Это та же логика, что в [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md): **агент задаёт цель, Claude решает как**; **skill указывает грабли, Claude знает как их обойти**.

### Анти-паттерн vs правильно

**Анти-паттерн (документация):**

```markdown
## Как настроить DbContext

DbContext — это основной класс Entity Framework Core, который управляет
сессией взаимодействия с базой данных. Чтобы его настроить, создайте класс:

public class AppDbContext : DbContext
{
    public DbSet<User> Users { get; set; }
    public DbSet<Order> Orders { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder options)
    {
        options.UseSqlServer("connection string");
    }
}

Затем зарегистрируйте его в Program.cs:
builder.Services.AddDbContext<AppDbContext>(...)
```

Проблемы: это первая страница документации EF Core. Claude знает, как создать DbContext, класс `DbContext`, метод `UseSqlServer`, `AddDbContext`. 30 строк — 0 новой информации.

**Правильно (ловушка):**

```markdown
### DbContext как Singleton

Плохо: `services.AddSingleton<AppDbContext>()` или DbContext в статическом поле
Правильно: `AddDbContext<AppDbContext>()` (Scoped по умолчанию)
Почему: Change Tracker растёт бесконечно (memory leak), stale данные, DbContext не thread-safe — concurrent access = random exceptions
```

4 строки. Claude получает то, что он мог забыть: конкретный failure mode + правильный вариант + причинно-следственная связь.

## Структура skill

Skill — это один markdown-файл с frontmatter.

### Путь в репозитории

```text
plugins/skills/dex-skill-<name>/
├── .claude-plugin/
│   └── plugin.json
└── skills/
    └── <name>/
        └── SKILL.md
```

Имя плагина: `dex-skill-<name>`. Имя skill внутри плагина: `<name>` (без префикса). Ссылка для императивной загрузки из агента: `dex-skill-<name>:<name>`.

### Frontmatter

**Обязательные поля:**

```yaml
---
name: <name>
description: <краткое назначение>. Активируется при keyword1, keyword2, ...
---
```

**Разрешённые опциональные поля** (по [официальной документации](https://code.claude.com/docs/en/skills)):

- `disable-model-invocation` — отключить automatic activation
- `user-invokable` — метка что skill может быть вызван пользователем напрямую
- `argument-hint` — подсказка аргументов
- `compatibility` — совместимость
- `license`
- `metadata` — произвольные метаданные

**Запрещённые поля:**

- `allowed-tools` — **не поддерживается** Claude Code для skills (это поле для агентов, и то не всегда)
- Любые другие кастомные поля, не упомянутые в официальной документации

### Тело skill

Markdown с группировкой ловушек по категориям. Каждая категория — H2. Каждая ловушка — H3 с короткими строками «плохо / правильно / почему».

## Правила для description (семантическая активация)

Description — **единственный механизм** автоматической активации skill. Claude Code семантически сопоставляет контекст разговора с описанием всех skill и подгружает наиболее релевантные. Плохой description = skill не активируется, значит его содержание не работает.

### Формат

```text
description: <1 предложение что skill делает>. Активируется при <keyword1>, <keyword2>, <keyword3>, ...
```

Две части:

1. **Назначение** — одно предложение, коротко и по существу.
2. **Ключевые слова** — после «Активируется при» через запятую, 15-25 штук.

### Правила

- **Stack-агностичность** — не привязывать к одному стеку, если skill применим шире. «Logging» — это не только Serilog. «Testing» — это не только xUnit.
- **Покрытие синонимов** — включать варианты написания: `node.js, nodejs, node api`.
- **Покрытие инструментов** — включать конкретные библиотеки / CLI: `jest, vitest, playwright` (не только абстрактные «тесты»).
- **Покрытие паттернов** — включать паттерны использования: `Promise.all, event loop, race condition`.
- **Без лишних слов** — писать просто «Активируется при», без «при упоминании» или «когда контекст содержит».
- **15-25 ключевых слов** — достаточно для хорошего покрытия, больше — шум, который размывает релевантность.

### Пример хорошего description

```text
description: Entity Framework Core — ловушки запросов, миграций, concurrency.
Активируется при entity framework, ef core, dbcontext, migration,
linq to entities, N+1, concurrency, locking, AsNoTracking, Include,
AsSplitQuery, ExecuteUpdate, ExecuteDelete, Change Tracker, SaveChanges,
AddAsync, cartesian explosion, ConcurrencyToken, IServiceScopeFactory
```

Короткое назначение + 18 ключевых слов, покрывающих API, паттерны, типичные проблемы. Skill сработает на любой разговор про EF Core.

### Пример плохого description

```text
description: EF Core skill
```

Проблемы: нет триггеров — semantic matching работать не будет; нет назначения — непонятно, это про ловушки или про документацию.

## Правила для ловушек

### Формат одной ловушки

```markdown
### <Название ловушки>

Плохо: `<короткий код или описание>`
Правильно: `<короткий код или описание>`
Почему: <объяснение в 1-2 предложения>
```

4 строки. Без лишнего.

### Принцип «указываем путь, не прокладываем дорогу»

В строке «Правильно» пишем **имя API, условие, флаг — pointer**, а не развёрнутый code snippet.

**Плохо (дорога):**

```markdown
Правильно:
var orders = await context.Orders
    .Include(o => o.Customer)
    .Where(o => o.Status == OrderStatus.Active)
    .OrderByDescending(o => o.CreatedAt)
    .Take(50)
    .ToListAsync();
```

10 строк boilerplate. Claude сам напишет это идеально, если знает ключевую мысль.

**Правильно (путь):**

```markdown
Правильно: `Include(o => o.Customer)` или projection `.Select(...)`
```

1 строка. Claude получает **указатель** на нужный инструмент и сам применит его в контексте пользователя.

### Обязательная часть «Почему»

Без «почему» ловушка превращается в запрет без обоснования — карго-культ. Разработчик, прочитавший правило, не поймёт границ его применимости и может нарушить в неочевидном случае.

«Почему» отвечает на два вопроса:

- **Что именно происходит плохого** при «плохом» варианте?
- **Как альтернатива это решает**?

Пример:

```markdown
### AsNoTracking забыт для read-only

Плохо: `context.Products.Where(p => p.IsActive).ToListAsync()` — все entities в Change Tracker
Правильно: `.AsNoTracking()` для данных, которые не будут изменяться
Почему: Change Tracker хранит копию каждой entity в памяти + сравнивает при DetectChanges. На 10000 записей — ощутимый overhead
```

«Почему» объясняет механизм (копия в Change Tracker + DetectChanges) и на каких данных проявляется (10000 записей).

### Категории ловушек

Ловушки группируются в H2-категории. Категория объединяет ловушки по общему признаку: область API, тип проблемы, этап работы.

Примеры категорий для ef-core skill:

- Запросы (N+1, AsNoTracking, проекция)
- Add vs AddAsync
- Cascade Delete
- Concurrency
- Bulk Operations
- Split Queries
- Миграции
- DbContext lifetime

Категорий в skill — 5-10. Меньше — плоская структура, труднее навигация. Больше — дробление, skill становится каталогом мелочей.

## Размер skill

- **Цель**: 80-120 строк.
- **Допустимо**: до ~150 строк.
- **Максимум**: 500 строк (официальный лимит Claude Code) — но приближаться не стоит.

Каждая ловушка: 3-5 строк. 10-15 ловушек на skill — достаточно.

**Если skill разрастается больше 150 строк** — сигнал, что:

1. В нём накапливаются ловушки из нескольких подтем, которые лучше разделить на отдельные skills (например, `dex-skill-ef-core` и отдельный `dex-skill-ef-core-migrations`).
2. Или в нём есть процедурные куски / документация, которые нужно вырезать.

## Что писать (и что нет)

**Писать:**

- Ловушки и anti-patterns с конкретными случаями
- Неочевидное поведение API
- Критические правила (нарушение = баг в проде)
- Trade-off'ы, где выбор зависит от контекста
- Ссылки на смежные skills при дублировании темы

**Не писать:**

- Документацию API (Claude знает)
- Примеры «как создать X» или «как начать работать с Y»
- Полные code samples с boilerplate
- Объяснения базовых концепций
- Шаги туториала («Шаг 1: создайте проект...»)
- Всё, что можно найти в official docs первой страницы

## Связь между skills и агентами

Skill и агент — **две разные сущности**. Эта граница описана в [AGENT_FRAMEWORK.md, раздел «Агент и skills»](AGENT_FRAMEWORK.md#агент-и-skills). Здесь — обратная сторона: что знает skill об агентах.

- **Skill не знает**, какой агент его загрузит. Один skill может использоваться и code-reviewer'ом, и api-designer'ом, и security-аудитором.
- **Skill не ссылается** на конкретные агенты — только на **смежные skills**, если есть дублирующая тема.
- **Skill не содержит фаз** — он статичный справочник, не workflow.
- **Skill загружается императивно** — агент в фазе вызывает `Skill dex-skill-X:X`. Skill попадает в контекст именно этого запроса.

### Дублирование между skills

Если две ловушки из разных skills говорят об одном — это плохо. Нужно:

1. **Вынести общее** в более базовый skill (LINQ-ловушки из `ef-core` → в `linq-optimization`)
2. **Оставить в одном месте**, из другого сделать ссылку:
   ```markdown
   > Общие LINQ ловушки (Count vs Any, фильтрация, коллекции) — см. `dex-skill-linq-optimization`
   ```
3. **Не дублировать** содержимое — разные копии расходятся со временем.

## Библиотека типовых категорий ловушек

Референсный список категорий, которые часто встречаются в skills. Не исчерпывающе — автор может придумывать свои. Использовать как подсказку при формировании структуры нового skill.

### Performance traps

N+1, материализация коллекций, blocking calls в async коде, лишние roundtrip'ы к БД, чтение всех колонок вместо проекции, отсутствие пагинации.

### Concurrency traps

Race conditions, deadlock, data race, lost updates, thread-unsafe shared state, missing locks, async void, fire-and-forget.

### Resource traps

Утечки памяти, unbounded growth коллекций, незакрытые handles / connections, captive dependency, singleton-with-state, event handlers без отписки.

### Security traps

Injection (SQL, XSS, command), auth bypass, IDOR, hardcoded secrets, CSRF, weak crypto, exposed internal APIs, missing validation на границах.

### Correctness traps

Граничные случаи, null handling, off-by-one, integer overflow, timezone ошибки, float сравнения, неправильные equality checks, silent failures.

### API usage traps

Deprecated methods, неправильные флаги, несовместимые версии, method X выглядит как Y но работает иначе, скрытые side effects, параметры в неочевидном порядке.

### Workflow traps

Неправильная последовательность шагов, пропуск обязательных фаз, commit без review, deploy без verify, migration без backup.

### Testing traps

Тесты зависят друг от друга, mocking реальных зависимостей, shared state между тестами, flaky тесты от времени / сети, тестирование деталей реализации вместо поведения.

## Рецепты по типам skills

Типовые скелеты skills под частые задачи. Как в [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md), это **рецепты**, не жёсткие контракты.

### Framework skill

Ловушки конкретного инструмента: Entity Framework Core, PyTorch, React, Docker.

**Категории обычно:**

- Основные API + их неочевидное поведение
- Lifecycle / scoping особенности
- Performance traps для типичных use case
- Версионные отличия, migration gotchas
- Интеграция с экосистемой

**Примеры в проекте**: `ef-core`, `pytorch`, `react`, `docker`.

### Pattern skill

Ловушки общего паттерна, не привязанного к конкретному инструменту: async/await, LINQ, logging, observability.

**Категории обычно:**

- Типичные неправильные применения паттерна
- Пересечение с другими паттернами
- Performance и correctness trade-off'ы

**Примеры в проекте**: `async-patterns`, `linq-optimization`, `logging`.

### Security skill

Категория уязвимостей или security best practices.

**Категории обычно:**

- Классы уязвимостей с конкретными примерами атак
- Типичные способы, которыми код становится уязвимым
- Trade-off'ы между безопасностью и удобством

**Примеры в проекте**: `owasp-security`.

### Workflow skill

Процессные грабли — git workflow, code review, release процесс, testing process.

**Категории обычно:**

- Этапы процесса и их типичные нарушения
- Coordination / handoff проблемы между этапами
- Что легко пропустить или сделать не в том порядке

**Примеры в проекте**: `git-workflow`, `testing-patterns`.

## Анти-паттерны

Чего делать нельзя при написании skill.

### 1. Документация API вместо ловушек

```markdown
## Как использовать EF Core

EF Core — это ORM для .NET. Основные классы:
- DbContext — сессия с БД
- DbSet<T> — коллекция сущностей
- ...
```

Неправильно. Первая страница документации EF Core. Claude знает.

### 2. Развёрнутый код вместо pointer'а

Неправильно: 10-15 строк полного класса/метода/try-catch блока. Claude сам напишет boilerplate под контекст пользователя. Правильно — одна строка с именем API или условием: `Include(o => o.Customer)`, `BeginTransactionAsync() + CommitAsync() в catch`.

### 3. Объяснения базовых концепций

```markdown
### Что такое async/await

async/await — это синтаксический сахар для работы с задачами. Когда вы
помечаете метод async, компилятор генерирует state machine, которая...
```

Неправильно. Это объяснение концепции, а не ловушки. Claude понимает async/await.

### 4. Шаги туториала

```markdown
### Как настроить EF Core

Шаг 1: Установите пакет Microsoft.EntityFrameworkCore
Шаг 2: Создайте класс DbContext
Шаг 3: Настройте connection string
...
```

Неправильно. Туториалы — это getting started, они есть в официальной документации.

### 5. Дублирование с другим skill

Если в `ef-core` skill написано про LINQ `Count() > 0 vs Any()`, а в `linq-optimization` skill написано то же самое — одно из двух удалить и оставить ссылку.

### 6. Привязка к одному стеку, когда skill универсальный

```markdown
## Logging с Serilog

### Log levels
Плохо: Information для всех событий
Правильно: Trace → Debug → Information → Warning → Error → Fatal
```

Неправильно. Log levels применимы ко всем logging фреймворкам (Serilog, NLog, winston, pino, log4j). Skill должен называться «logging», а не «serilog-logging».

### 7. Description без ключевых слов

```yaml
description: Skill про базы данных
```

Неправильно. Semantic activation работать не будет. Нужны конкретные ключевые слова: `sql, postgres, mysql, query, index, explain, ...`.

### 8. Слишком большой skill

Skill из 400 строк — признак того, что в нём либо смешано несколько подтем, либо есть процедурные куски / документация. Разделить на два skill или сократить.

### 9. Ловушка без «почему»

```markdown
### AsNoTracking забыт

Плохо: `context.Products.ToListAsync()`
Правильно: `context.Products.AsNoTracking().ToListAsync()`
```

Неправильно. Нет объяснения, почему это проблема. Разработчик прочитает — не поймёт. В каких случаях tracking нужен? Когда можно пропустить? Без «почему» правило — карго-культ.

## Пример полного skill

В качестве референсного примера — `dex-skill-ef-core` в проекте. Его полный текст лежит в `plugins/skills/dex-skill-ef-core/skills/ef-core/SKILL.md`. Здесь — начальные 30 строк, иллюстрирующие все принципы фреймворка.

```markdown
---
name: ef-core
description: Entity Framework Core — ловушки запросов, миграций, concurrency. Активируется при entity framework, ef core, dbcontext, migration, linq to entities, N+1, concurrency, locking, AsNoTracking, Include, AsSplitQuery, ExecuteUpdate, ExecuteDelete, Change Tracker, SaveChanges, AddAsync, cartesian explosion, ConcurrencyToken, IServiceScopeFactory
---

# Entity Framework Core — ловушки и anti-patterns

## Запросы

### N+1 — ленивая загрузка

Плохо: `orders[0].Customer.Name` — каждое обращение к навигации = скрытый SQL запрос
Правильно: `Include(o => o.Customer)` или `.Select(o => new { o.Id, o.Customer.Name })`
Почему: 100 заказов = 1 + 100 запросов вместо одного. Проблема тихая — нет ошибки, только медленно

### AsNoTracking забыт для read-only

Плохо: `context.Products.Where(p => p.IsActive).ToListAsync()` — все entities в Change Tracker
Правильно: `.AsNoTracking()` для данных, которые не будут изменяться
Почему: Change Tracker хранит копию каждой entity в памяти + сравнивает при DetectChanges. На 10000 записей — ощутимый overhead

### ToList() вместо проекции

Плохо: `context.Orders.Include(o => o.Items).ToListAsync()` — для списка нужны только Id и Total
Правильно: `.Select(o => new OrderDto(o.Id, o.Total, o.Items.Count)).ToListAsync()`
Почему: грузишь 20 полей × 1000 строк вместо 3 полей × 1000 строк. SQL тяжелее, трафик больше, Change Tracker раздувается

> Общие LINQ ловушки (Count vs Any, фильтрация, коллекции) — см. `dex-skill-linq-optimization`
```

Что здесь показано:

- **Description** с 18 ключевыми словами для semantic activation
- **Категория** Queries с тремя ловушками
- **Формат** Плохо / Правильно / Почему, каждая ловушка — 4 строки
- **Pointer, не код**: `Include(o => o.Customer)` вместо развёрнутого класса-репозитория
- **Ссылка на смежный skill** вместо дублирования LINQ-ловушек
- **Почему** в каждой ловушке: что происходит и как альтернатива это решает

Полный файл содержит ещё 9 категорий и 12 ловушек, в сумме 114 строк — точно в целевом диапазоне фреймворка.

## Соответствие текущим проектным правилам

Фреймворк консолидирует существующие правила из CLAUDE.md и других документов:

- **Skills как ловушки, не документация** — было в CLAUDE.md, здесь формализовано с примерами и обоснованием
- **Формат Плохо/Правильно/Почему** — было в CLAUDE.md, здесь детализировано с принципом «pointer, не код»
- **Правила description** — было в CLAUDE.md, здесь переписано с акцентом на semantic activation
- **Размер 80-150 строк** — сохранено, обоснование расширено
- **Императивная загрузка в агентах** — согласовано с [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md), skill не знает о конкретных агентах
- **Ревью по официальной документации** — ссылки на [skills docs](https://code.claude.com/docs/en/skills) и [best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) остаются актуальными

## Миграция CLAUDE.md

После принятия этого документа раздел «Гайдлайны: как писать Skills» в CLAUDE.md заменяется короткой ссылкой:

```markdown
## Гайдлайны: как писать Skills

Подробные правила см. в [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) —
принципы, формат, анти-паттерны, библиотека категорий, пример полного skill.

Краткая суть: skill — это ловушки и anti-patterns, не документация API.
Claude знает синтаксис и базовые концепции; skill нужен для неочевидного
поведения, критических правил и trade-off'ов.
```

Это разгружает CLAUDE.md (убирается ~95 строк) и создаёт single source of truth для правил skills. Дубли между двумя файлами исчезают — при любых будущих правках изменяется только `SKILL_FRAMEWORK.md`.

## Self-check перед коммитом

Чек-лист для автора skill. То же самое проверяет `node tools/validate-skill.js <path>`, но в человекочитаемой форме.

- [ ] Frontmatter: есть `name` и `description`
- [ ] Frontmatter: **нет** `allowed-tools:` (не поддерживается Claude Code)
- [ ] Description содержит «Активируется при» + минимум 10-15 ключевых слов
- [ ] Description stack-агностичен (если тема применима шире одного инструмента)
- [ ] Размер 80-150 строк (максимум 500)
- [ ] Ловушки сгруппированы в H2-категории, каждая ловушка — H3
- [ ] Каждая ловушка содержит триаду: Плохо / Правильно / Почему
- [ ] «Правильно» = pointer (имя API, условие), не развёрнутый код
- [ ] Нет code fences длиннее 5 строк
- [ ] Нет документации API, туториалов, объяснений базовых концепций
- [ ] Нет дублирования с другим skill (если пересечение — ссылка, не копия)
- [ ] Нет заголовков в стиле «Как настроить X», «Что такое Y», «Шаг N»

## Что дальше

- Audit существующих 42 skills через призму фреймворка — определить gap'ы и план миграции
- Rollout — переписать skills с серьёзными нарушениями (documentation-стиль, отсутствие «почему», развёрнутые code samples)

Для **новых** skills фреймворк обязателен. Для существующих — миграция постепенная, валидатор работает в мягком режиме.
