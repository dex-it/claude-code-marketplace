---
description: Архитектурная сессия по бизнес-задаче или выходу /feature - требования, capacity, дизайн-решение с CAP/PACELC, implementation plan, ADR/API-spec/диаграммы, приёмка design-reviewer
allowed-tools: Read, Edit, Write, Bash, Grep, Glob, Skill
argument-hint: "[бизнес-задача в свободной форме / путь к апрувнутым требованиям из /feature]"
---

# /design

Провести бизнес-задачу (или выход зоны требований) через зону дизайна - от требований до одобренного
design-документа - входа трека «Разработка».

## Goal

Провести задачу через универсальный цикл движка и фазы трека
`dex-skill-architecture-track:architecture-track`: Bootstrap, Understand Requirements, Capacity
Estimation, Design Decision (делегировано `architect`/`architect-dotnet` по стеку), Implementation
Plan, Document (условно - ADR/API-spec/диаграммы), Design Acceptance (`design-reviewer`).

## Input

Аргумент - постановка в одной из двух форм:

- **бизнес-задача в свободной форме** («хочу новостную ленту», «нужен сервис уведомлений», «как
  переехать с монолита на сервисы») - требования уточняются в Phase 1 трека;
- **апрувнутый набор зоны требований** (путь к `FR`/`NFR` системного уровня и user stories,
  приходит из `/feature`; вход только BRD с `BR-NNN`, без системного уровня - принимается как
  бизнес-задача, но `FR`/`NFR` выводит Phase 1 сама и помечает допущениями: апрувнутым набором они
  не считаются) - требования уже прогнаны оракулом, Phase 1 доверяет метке `quality-checks` и не
  дублирует полный обход.

Если аргумент не передан - трек интерактивно запрашивает постановку в первом сообщении. Стек (.NET
vs стек-нейтральный) трек определяет сам по манифесту затронутой папки - явно указывать не нужно.

## Output

- Requirements (FR/NFR + security/data sensitivity + constraints + success metrics), capacity-таблица
- Design Decision: reference-match, альтернативы с Mermaid-диаграммами, решение с CAP/PACELC
  trade-off'ами, deep dive (storage/API/caching/failure modes/security/observability)
- Implementation plan **файлом** по ключу `plans` расклада корпуса (walking skeleton -> vertical
  slices -> scale-out): критерии приёмки с метками `[FR-NNN]`/`[NFR-NNN]`, контракты пересекаемых
  границ, артефакты сверх кода; вердикт `plan-quality: passed` в шапке файла
- ADR/API-spec/диаграммы - там, где затребованы или обязательны по pre-check; порог ADR - цена отмены решения (миграция данных, контракт с внешним потребителем, чужой код по этому решению, публично зафиксированный формат), а не новизна нормы
- Вердикты `design-reviewer`: `design-quality: passed` в шапке design-документа и
  `plan-quality: passed` в шапке плана - без обоих трек не передаёт хэндофф дальше

## Constraints

- Дизайн-решение принимает узел (`architect`/`architect-dotnet`), не трек и не эта команда
- Минимум 2 жизнеспособных альтернативы в Design Decision
- Бюджетная/продуктовая рамка и приоритет между конфликтующими NFR - блокирующий гейт (работа
  встаёт до ответа оператора); выбор между технически равными альтернативами - неблокирующий,
  трек предъявляет и продолжает
- Design Acceptance обязателен и судит и решение, и план: любой из двух вердиктов не `passed` ->
  возврат на доработку или эскалация, хэндофф в «Разработку» не уходит

Следующий шаг - `/implement` (путь одобренного плана и design-документа - его вход).
Вызови `Skill` -> `dex-sdlc:engine` (откроет/возобновит цикл, авто-ledger с треком
`dex-skill-architecture-track:architecture-track`), затем `Skill` ->
`dex-skill-architecture-track:architecture-track` с **`mode: interactive`** - без этого поля трек
берёт автономную планку (`autonomous`) и блокирующие гейты не встанут перед оператором: канал у
тела команды есть, останавливаться на нём трек будет только с этим полем.
