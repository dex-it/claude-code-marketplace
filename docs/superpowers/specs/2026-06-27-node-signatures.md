# Карта сигнатур узлов ядра «Разработка» (из инвентаризации)

**Дата:** 2026-06-27
**Источник:** разведка по телам агентов (фазы Understand/Intake = вход, Validate/Report = выход).
**Назначение:** сырьё для контракта `pipeline-handoff` + будущей карты в оркестраторе (`autonomous-task` при переносе). Это ФАКТ из агентов, не проект.

Охват: coder×2, tester×2, bug-fixer, self-reviewer (правим). architect×2 — только выход (вход отложен). feature-implementer исключён (агрегат).

## Сигнатуры

| Узел | INPUT (требует) | OUTPUT (отдаёт) | Транспорт входа |
|---|---|---|---|
| **dotnet-coder** | требование (типы in/out, sync/async, error-handling, scope, побочные эффекты) [обяз]; проектный контекст (арх-стиль, паттерны, naming, DI, Accepted ADR) [обяз, кроме standalone] | изменённые/созданные файлы; объяснение решений; статус build (`dotnet build`); статус test (если затронуты) | текст промпта |
| **ts-fullstack-assistant** | требование [обяз]; слой (backend/frontend/fullstack); framework/ORM/error-handling/auth (выясняет сам); проектный контекст (кроме нового проекта) | изменённые файлы; пояснение; статус `tsc --noEmit`; lint; smoke (если применимо) | текст промпта |
| **bug-fixer** | баг-карточки (симптом, repro, expected/actual, severity, улики) [обяз]; стек/версии [обяз]; BASE_BRANCH (деф. origin/develop) [обяз]; развёртывание стенда (для стенд-багов) | статус каждого бага (закрыт red->green / отложен с причиной); полный прогон зелёный; локальные коммиты на follow-up ветке; открытые наблюдения | текст промпта (свой формат карточек, нормализуется в Phase 0) |
| **dotnet-test-writer** | код под тест [обяз]; success criteria (сценарии, edge, happy+failure, ожидаемое) [обяз]; тест-контекст (фреймворк, mock-либа, fixtures) [опц, кроме standalone] | тест-файлы; статус build+test; список зелёных сценариев; пояснения | текст промпта |
| **ts-test-writer** | код под тест [обяз]; сценарии (happy/failure/edge) [обяз]; импорты для моков [обяз]; конфиг проекта [опц] | тест-файлы (`.test.ts`); `validation: passed/skipped`; `tsc --noEmit`; зелёные тесты; пояснения | текст промпта |
| **self-reviewer** | **success criteria / источник намерения** (для intent-gate) [обяз, если есть]; команды прогона проекта [обяз]. **diff НЕ принимает — берёт сам из git** (committed+staged+worktree, Phase 0) | находки (file:line, severity, confidence, evidence, intentStatus, verificationStatus); чеклист правок до push; gate на push | **git/worktree** (не handoff) |
| **architect** (только выход) | (отложен) | план: инкременты (walking skeleton -> vertical slices -> scale-out); per-инкремент Scope/Dependencies/Risks/DoD/Success metric; Deep Dive (storage/API/cache/sharding/failure/security/observability) | -> coder |
| **architect-dotnet** (только выход) | (отложен) | то же по форме (идентично architect), .NET-конкретика в деталях | -> coder |

## Открытия инвентаризации (расхождения со spec)

1. **self-reviewer сам берёт diff** — ребро 3 для него = намерение, не diff-скоуп. Spec поправлен (ребро 3).
2. **«Следующий узел» не нормативен** — bug-fixer/architect называют, coder/tester нет; маршрут решает оркестратор. Spec поправлен (заметка в ребре 3).
3. **architect выход = инкременты + DoD**, не «R/I + success criteria» дословно. DoD ~= success criteria; R/I в плане отдельно не перечислены. ОТКРЫТО: согласовать форму ребра 1 (план architect vs ожидание coder).
4. **Форма выхода architect и architect-dotnet идентична** — единое ребро 1 реально.

## Что осталось (для правки агентов)

Каждый правимый узел (coder×2, tester×2) получает в фазе входа:
- декларацию `Input (handoff)` через словарь pipeline-handoff;
- **валидацию входа**: проверить полноту обязательных полей;
- **возврат на доработку**: нехватка обязательного поля -> вернуть вопрос источнику (mode-aware), не домысливать.

И в фазе выхода — декларацию `Output (handoff)` + сигнатуру в `description` (для обнаружения оркестратором).

self-reviewer: только намерение на входе + валидация его наличия (нет намерения -> intent: n/a, не блокер). bug-fixer/architect — не правим (только признаём источниками / выходом).
