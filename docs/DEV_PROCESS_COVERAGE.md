# Покрытие процесса разработки агентами

Карта «слот процесса разработки → агент, который его закрывает». Процесс
стек-нейтральный; для слотов со специальными агентами показаны варианты под стек.

> Назначение: при автономной или ручной разработке видно, какой профильный
> исполнитель отвечает за каждый шаг. Подбор исполнителя — по типу работы + стеку
> (см. [AGENT_SPECIALIZATION.md](AGENT_SPECIALIZATION.md) — общий vs специальный).

## Процесс разработки (слоты)

```
Контекст → План → [TDD-тесты → Код] → Прогон+Саморевью → Security → [Debug | Perf] → Сдача
```

## Карта слот → агент

| Слот | Что делается | .NET | TS/JS | Общий fallback |
|------|--------------|------|-------|----------------|
| **Контекст** | прицельный сбор: код вокруг фичи, контракты, потребители | — | — | general-purpose / Explore |
| **План / спека** | дизайн нетривиальной фичи (требования → capacity → alternatives → plan) | dex-architect-dotnet | dex-architect¹ | dex-architect |
| └ ADR | если решение значимо | — | — | dex-adr-writer |
| └ диаграмма | если нужна C4/sequence | — | — | dex-diagram-creator |
| └ публичный API | если проектируется контракт | — | — | dex-api-designer |
| **TDD-тесты** | тесты ожидаемого поведения до кода | dex-dotnet-tester | dex-ts-tester | — (идиоматично, fallback слабый) |
| **Код** | реализация в стиле окружения | dex-dotnet-coder | dex-ts-fullstack-coder | — |
| **Прогон + саморевью** | build/test/lint зелены + ревью своего кода (вкл. арх) | self-reviewer² | self-reviewer² | self-reviewer |
| **Security** | отдельный обязательный security-проход | dex-security-reviewer³ | dex-security-reviewer³ | dex-security-reviewer |
| **Debug** | root-cause бага по коду (при красном прогоне) | dex-debugger⁴ | dex-debugger | dex-debugger |
| **Perf** | оптимизация (N+1, alloc, hot path) — по нужде | dex-dotnet-performance | — ⁵ | — |
| **Сдача** | коммит/MR по конвенции, трекер | — | — | сам (git) |

### Сноски

1. **JS/TS-архитектора нет** — JS-фичу ведёт общий `dex-architect` + условные
   JS-skills. Специализация отложена (мало архитектурных JS-skills), см.
   AGENT_SPECIALIZATION.md.
2. **self-reviewer закрывает сразу три слота**: прогон (Local verification —
   реально гоняет build/test/lint), ревью кода и архитектурное ревью (7 фокусов:
   security/architecture/language/business/regressions/loose-ends/local-verification).
   Языко-агностичный. Выделенный арх-ревьюер не нужен.
3. **Security — отдельный проход**, не растворённый в общем ревью: даже если общее
   ревью «чисто», security проходится отдельно. `dex-security-reviewer` —
   языко-агностичный, усиливается частными skills по стеку.
4. **Один debugger** на все стеки (root-cause процесс нейтрален). Для runtime по
   живому процессу/дампу — `dex-dotnet-runtime-diagnostician`.
5. **Perf под TS** не покрыт специальным агентом (вне текущего скоупа).

## Чужой MR — отдельный процесс (не часть разработки)

Ревью **входящего** MR — другой процесс (read-only, выход = комментарии, код не
трогаем):

| Слот | Агент |
|------|-------|
| первичное ревью MR | dex-mr-reviewer (языко-агностичный, фокусы + публикация) |
| ре-ревью дельты | dex-mr-check-reviewer |
| breadth-first аудит существующего кода | dex-code-discovery |

## Статус миграции (целевое состояние карты)

Карта отражает целевое распределение ролей. На момент написания не исполнено:

- `dex-dotnet-debugger` (bug-hunter) — под удаление (дубль общего debugger).
- `dex-dotnet-reviewer` (code-reviewer) — под удаление (поглощён self+mr-reviewer).
- `dex-security-reviewer` — под доработку (threat-model, чтобы не дублировать
  security-фокус self-reviewer).

До исполнения этих изменений соответствующие .NET-агенты ещё присутствуют в
репозитории; карта показывает, кто закрывает слот после миграции.
