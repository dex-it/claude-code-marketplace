# clean-architecture: сжатие по свидетельству, группа 1.2

Скилл `dex-skill-clean-architecture` 1.4.1 ([`inputs/SKILL-1.4.1.md`](inputs/SKILL-1.4.1.md)) -> 1.5.0
([`inputs/SKILL-1.5.0.md`](inputs/SKILL-1.5.0.md)), эпик #291, группа 1.2 (#294). Промежуточная
редакция n1 - [`inputs/SKILL-n1.md`](inputs/SKILL-n1.md), тело 1.5.0 с ней совпадает, правлено только
`description`.

Вход, исполнитель (`claude-sonnet-5-5`, effort medium, MCP нет), промпты, наборы и правило
засчитывания - общие для группы, в протоколе [solid](../solid/README.md#заход-группы-12-2026-10-05).
Кейс - A2 (кредит-ноты, BILL-33: первое хранение в БД, EF Core + SQLite), выходы - в протоколе
[ddd](../ddd/README.md) (`runs/a2-*`).

## Потребители

Skill tool в фазе: `mr-reviewer`, `mr-check-reviewer`, `self-reviewer` (ось `architecture`),
`discover-reviewer`, `architect` и `architect-dotnet` (Phase 2, 4), `design-reviewer`, `adr-writer`,
`diagram-creator`. Тематическая строка `stack-registry`, сноска в `design-quality`. Бандлы:
`architect`, `code-review`, `dotnet-developer`, `dotnet-fullstack`, `ts-fullstack`, `system-analyst`,
`bug-lifecycle`. Кейс активации `clean-architecture-in`.

## Вердикт

| Ловушка 1.4.1 | Кейс | Контроль | n2 | Исход |
|---|---|---|---|---|
| Domain зависит от Infrastructure | A2 C-a: `[Table]`, `[Index]` в домене | 2/2 | 2/2 | снята |
| Application -> DbContext напрямую | A2 C-b | 2/2 (c2 minor) | 2/2 | снята |
| IRepository возвращает IQueryable | A2 C-d | 2/2 | 2/2 | снята |
| Domain entity выставляет persistence-детали | A2 C-e: `virtual ICollection { get; set; }` | 2/2 по симптому: `TotalMinor` не пересчитан | 2/2 | снята |
| DTO используется как Domain model | A2 C-f | 2/2 | 2/2 | снята |
| Entity в параметрах Command | A2 C-g | 2/2 по симптому: `invoice!` -> 500 | 2/2 | снята |
| Repository возвращает Entity вместо проекции | A2 C-h | 2/2 | 2/2 | снята |
| Логика в Controller | A2 C-j | 2/2 | 2/2 | снята |
| Валидация в Domain вместо Application (I/O в домене) | A2 C-k | 2/2 | 2/2 | снята |
| Логика в Infrastructure | A2 C-l | 2/2 | 2/2 | снята |
| Расчёт, размазанный по вызовам в handler | A2 C-m | 2/2 | 2/2 | снята |
| Несколько `SaveChangesAsync` в Handler | A2 C-n | 2/2 | 2/2 | снята |
| Handler вызывает другой Handler | A2 C-o | 2/2 | 2/2 | снята |
| Mock всего дерева зависимостей | дом - `solid` SRP | - | - | дубль: живёт названием `solid` «класс с несколькими причинами изменения»; тестов кейсы не требуют - открыто |
| God DbContext | дом - `ddd` | - | - | дубль: живёт названием `ddd` «один `DbContext` на все контексты» - открыто |
| Circular dependency между слоями | - | - | - | открыто, название остаётся |
| Специализированный метод репозитория при specification-базе | - | - | - | открыто, название остаётся |
| Тестирование через HTTP вместо Unit | - | - | - | открыто, название остаётся |
| Папка-на-слой вместо Feature Slice | - | - | - | открыто, название остаётся |
| Общий проект Shared/Common | - | - | - | открыто, название остаётся |
| Чек-лист | - | повтор названий | - | снят |

Тринадцать измеренных ловушек контроль ловит 2/2 - все сняты; n2 (набор без них) берёт их тоже 2/2,
сужения охвата нет. Противоречие «один `SaveChanges`» (`clean-architecture`) и «один агрегат на
транзакцию» (`ddd`) снято вместе с C-n.

**Без кейса.** Пять ситуаций требуют масштаба или основы, которых в Billing нет: многопроектный
solution (циклическая ссылка, Shared/Common), 100+ сценариев (папка-на-слой), тесты (RUL-0002, задача их
не требует), specification-база репозитория. Без свидетельства единица не снимается: 1.5.0 - пять
названий без вердикта.

**Приманки и охват.** A2: PQ (`QuoteInvoiceHandler` -> `FxRatesClient` вне диффа), PD (три `DbSet` -
не God DbContext), PL (DTO списка) - не подняты blocker/major ни в одном наборе; O1, O2 - 2/2.

## Открыто

- Скилл из пяти «открытых» названий. Вопрос владельцу: держать его так или завести кейс с
  многопроектным solution (Billing.Domain, Billing.Application, Billing.Infrastructure, Shared).
- `diagram-creator` и `adr-writer` грузят скилл для диаграмм слоёв и валидации паттернов; эти
  поручения не мерились.

## Бюджет правки

| Носитель | До | После | Взамен |
|---|---|---|---|
| `clean-architecture/SKILL.md` | 13388 байт, 140 строк | 1303 байт, 14 строк | 20 ловушек и чек-лист -> 5 названий без кейса |
| `description` | IQueryable, Application layer, MediatR, IUnitOfWork, God DbContext | предмет 5 пунктов | патч поля; кейс `clean-architecture-in` переведён с IQueryable (снят) на структуру проектов, прогон 3/3 |
| README `architect`, `architect-dotnet`, бандл `code-review` | «layers, dependencies, transactional boundaries» | структура solution | подпись строки загрузки |

Норма письма: носитель меньше, чем до правки. Рез через `dex-skill-optimize-for-llm` -
`unverifiable` (вызова `Skill` у исполнителя группы нет).
