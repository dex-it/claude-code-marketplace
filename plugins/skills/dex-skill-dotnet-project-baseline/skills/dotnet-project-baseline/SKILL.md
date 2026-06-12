---
name: dotnet-project-baseline
description: Технический baseline нового .NET проекта — наследование правил solution vs закладка с нуля. Активируется при новый проект, новый сервис, новый микросервис, создать проект, создать решение, добавить проект, scaffold, scaffolding, bootstrap, dotnet new, dotnet new sln, пустой репозиторий, golden path, скелет проекта, project structure, Directory.Build.props, Directory.Packages.props, CPM, .editorconfig, начальная настройка проекта, project template, baseline проекта
---

<!-- skill-type: process -->

# Baseline нового .NET проекта

Новый проект должен **рождаться** с активными analyzers, warning-профилем и
правильной конфигурацией, а не докручиваться через месяц. Этот skill — про то,
**как** заложить baseline: новый solution с нуля vs добавка в существующий.
Детали по каждой теме (csproj, code-quality, config, logging, DI, validation) —
в отдельных skills; их агент загружает рядом с этим в той же фазе. Сноски
`> см.` ниже — указатели на эти skills, не механизм автозагрузки: skill не
подтягивает другой skill, это делает агент через Skill tool.

## Сначала определи контекст

### Новый solution с нуля (пустой репозиторий)
Плохо: создать `.csproj` голым шаблоном `dotnet new` и отложить гигиену «на потом» —
без CPM, без warning-профиля, без analyzers
Правильно: заложить baseline целиком **по дефолту**, без переспроса
Почему: нарушать нечего — чужих конвенций нет. Golden path задаётся сразу, и
дальше весь код в проекте пишется уже под активным warning-профилем; докрутить
гигиену в проекте с накопленным кодом — дороже и под warning'ами всё краснеет разом

### Новый проект внутри существующего solution
Плохо: заложить свой baseline поверх — продублировать версии пакетов в `.csproj`,
переопределить `Directory.Build.props`, навязать свой `.editorconfig`
Правильно: прочитать существующие `Directory.Build.props` /
`Directory.Packages.props` / `.editorconfig`, **унаследовать** их, добавить только
недостающее для нового проекта; версии пакетов — в общий `Directory.Packages.props`,
не в `.csproj`
Почему: solution уже задаёт baseline на своём уровне. Конфликт «мой baseline vs
правила solution» всегда решается в пользу solution — это конвенции владельца, не
твои. Дублирование версий в `.csproj` при включённом CPM рассинхронизирует решение

## Чего не хватает в solution

### Мягко предупреждать о недостающей гигиене, не навязывать
Плохо: молча досоздать CPM / включить analyzers / усилить warning-профиль, которых
в solution нет; либо молча проигнорировать их отсутствие
Правильно: подсветить — «в solution нет X (CPM / analyzers / warning-профиль) —
заложить в новом проекте или предлагаю включить на уровне решения?» — и оставить
решение за владельцем
Почему: отсутствие гигиены в чужом solution — находка, а не данность; молчать о ней
нельзя. Но и решать за владельца его конвенции — нельзя. Дефолт: подсветить

## Что входит в baseline (детали — в отдельных skills, которые грузит агент)
- **csproj-гигиена** — CPM (`Directory.Packages.props`), `Directory.Build.props`,
  `PrivateAssets` для analyzers > см. `dex-skill-dotnet-csproj-hygiene`
- **code-quality** — Roslyn analyzers, `AnalysisMode`, warning-профиль
  (`TreatWarningsAsErrors`), NuGet security audit > см. `dex-skill-dotnet-code-quality`
- **config** — options pattern, `IOptions` + `ValidateOnStart`, окружения
  (если есть конфигурация) > см. `dex-skill-dotnet-config-hygiene`
- **logging** — structured logging с порога, без `Console.WriteLine`
  (если сервис, не голая библиотека) > см. `dex-skill-dotnet-logging`
- **DI** — корректные lifetime с начала, без captive dependency
  (если есть DI-контейнер) > см. `dex-skill-dotnet-di`
- **validation** — серверная валидация входных DTO
  (если принимает внешний ввод — HTTP / очередь) > см. `dex-skill-dotnet-validation`

Для голой библиотеки без HTTP/host — только csproj-гигиена + code-quality.

## Границы

### Baseline — технический скелет, не бизнес-логика и не тесты
Плохо: под видом «baseline» создавать бизнес-логику, тест-проект или выбирать
архитектурный стиль / разбиение на слои
Правильно: baseline — это **технический** скелет (структура + конфигурация).
Бизнес-код и тест-проект — по явному запросу; выбор архитектуры — отдельная задача
Почему: baseline — инвариант «проект настроен правильно», он не подменяет ни
реализацию фичи, ни архитектурное проектирование
