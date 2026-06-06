---
name: dotnet-code-quality
description: Гигиена .NET проекта — анализаторы и контроль качества кода. Активируется при анализатор не сработал, варнинг в билде, warning as error, EnableNETAnalyzers, AnalysisMode, подавить варнинг, NoWarn, vulnerable package, NuGetAudit, уязвимость в пакете, code style в билде, NSDepCop, нарушение слоёв, dotnet format в CI, code coverage порог, quality gate
---

# .NET code quality — анализаторы и контроль качества

> Структура .csproj (PackageReference, CPM, Directory.Build.props, PrivateAssets для analyzers) — см. dex-skill-dotnet-csproj-hygiene. Здесь — включение анализаторов, warning-профиль, аудит зависимостей.

## Включение анализаторов

### Анализаторы включены не централизованно
Плохо: `EnableNETAnalyzers` / `AnalysisMode` прописаны в части .csproj, в остальных — дефолт
Правильно: `<EnableNETAnalyzers>true</EnableNETAnalyzers>` и `<AnalysisMode>Recommended</AnalysisMode>` — в корневом `Directory.Build.props`, один раз
Почему: разный профиль анализа по проектам = одни предупреждения ловятся, другие нет в том же решении. Источник истины должен быть один

### AnalysisMode перебивает bulk-настройки .editorconfig
Плохо: в `.editorconfig` через `dotnet_analyzer_diagnostic.category-*.severity` включена категория правил, но в проекте стоит `<AnalysisMode>`
Правильно: понимать приоритет — при заданном MSBuild-свойстве `AnalysisMode` bulk-конфигурация из `.editorconfig` **игнорируется**; точечные `dotnet_diagnostic.CAxxxx.severity` продолжают работать
Почему: задокументированное поведение SDK. «Включил категорию в editorconfig, а правила молчат» — потому что bulk перекрыт MSBuild-свойством

### Code style (IDE-правила) не проверяется в билде
Плохо: настроили `dotnet_diagnostic.IDExxxx.severity = warning` в `.editorconfig`, но билд их не репортит
Правильно: добавить `<EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>` — иначе IDE-правила (IDExxxx) работают только в редакторе, не в build/CI
Почему: по умолчанию style-анализ в билде выключен. Без флага CI пропускает нарушения стиля, на которые настроен .editorconfig

## Warning-профиль: относиться к предупреждениям серьёзно

### Варнинги копятся и игнорируются
Плохо: билд зелёный с сотней warning'ов, новые тонут в шуме
Правильно: `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` — он эскалирует в ошибки и компиляторные, и analyzer/CA-варнинги (CAxxxx). `<CodeAnalysisTreatWarningsAsErrors>false</CodeAnalysisTreatWarningsAsErrors>` нужен лишь чтобы вывести CA-варнинги из-под ошибок при включённом `TreatWarningsAsErrors`. Если разом нельзя — зафиксировать baseline и фейлить CI на новых
Почему: предупреждение, которое не фейлит билд, не чинится никогда. Шум скрывает реальные баги (CA2007, CA1816, nullable warnings)

### Глушение целыми категориями через NoWarn
Плохо: `<NoWarn>CA1822;CA2007;IDE0058;CS8618</NoWarn>` в Directory.Build.props без обоснования
Правильно: отключать правило только с причиной — точечно `dotnet_diagnostic.CAxxxx.severity = none` в `.editorconfig` рядом с комментарием почему, либо `[SuppressMessage(Justification = "...")]` на конкретном члене
Почему: глобальный NoWarn гасит правило везде, включая места, где оно ловит настоящий баг. Подавление без `Justification` неотличимо от «забыли разобраться»

### Точечное подавление без следа
Плохо: `#pragma warning disable CA1062` на весь файл, без restore и без причины
Правильно: узкий scope `disable ... restore` вокруг конкретной строки + комментарий-обоснование; для CA — атрибут `[SuppressMessage]` с непустым `Justification`
Почему: широкий `disable` без `restore` гасит правило до конца файла и прячет последующие настоящие нарушения

## Аудит зависимостей (NuGet security)

### NuGetAuditMode по умолчанию не покрывает транзитивные
Плохо: полагаться на дефолт и считать, что сканируются все пакеты
Правильно: явно `<NuGetAuditMode>all</NuGetAuditMode>` — на .NET 8/9 по умолчанию аудятся только **прямые** зависимости; транзитивные (где чаще всего и сидит уязвимость) — нет. На .NET 10 `all` стал дефолтом, но явное свойство снимает зависимость от версии SDK
Почему: уязвимость в транзитивном пакете не видна при дефолте direct. Большинство CVE приходит именно через транзитивный граф

### Audit-предупреждения глушатся
Плохо: `<NuGetAudit>false</NuGetAudit>` или `<NoWarn>NU1901;NU1902;NU1903;NU1904</NoWarn>`, чтобы билд был зелёным
Правильно: оставить аудит включённым (дефолт с .NET 8); уязвимость — это сигнал «обнови/обоснуй», а не «заглуши». Поднять до ошибки: `<WarningsAsErrors>NU1903;NU1904</WarningsAsErrors>` (high/critical)
Почему: NU1901-1904 = известные уязвимости с advisory. Глушение прячет реальный риск безопасности под видом «чистого билда»

### Уязвимости и deprecated не проверяются в CI
Плохо: про уязвимые/устаревшие пакеты узнают вручную или никогда
Правильно: в CI как gate — `dotnet list package --vulnerable --include-transitive` и `dotnet list package --deprecated`; ненулевой результат фейлит pipeline
Почему: без автоматической проверки drift зависимостей накапливается молча. `--include-transitive` обязателен — без него виден только верхний слой

## Контроль внутренних зависимостей (NSDepCop)

### Слои не изолированы — нет контроля графа namespace
Плохо: архитектурные правила «Domain не зависит от Infrastructure» держатся только на code review
Правильно: подключить **NsDepCop** (NuGet, Roslyn-анализатор с v2.0) + `config.nsdepcop` с allowlist-подходом: `<Allowed From="..." To="..."/>`, `ChildCanDependOnParentImplicitly="true"`
Почему: ревью пропускает нарушения слоёв; анализатор ловит их на каждом билде. Allowlist (всё запрещено, разрешаем явно) надёжнее denylist

### Пакет стоит, а анализ молча не работает
Плохо: добавили NsDepCop, но нет `config.nsdepcop` в проекте — билд зелёный, контроля нет (NSDEPCOP03 «No config file found» имеет severity Info)
Правильно: убедиться, что `config.nsdepcop` есть и его build action = `C# analyzer additional file` (NuGet-пакет проставляет сам; при ручном добавлении файла — забывают)
Почему: без конфига анализатор тихо скипает проект. Info-диагностика теряется в выводе — «вроде подключили», а правил нет

### Нарушение зависимости не фейлит билд
Плохо: NsDepCop находит нелегальную зависимость, но билд проходит (NSDEPCOP01 по умолчанию Warning)
Правильно: эскалировать в `.editorconfig`: `dotnet_diagnostic.NSDEPCOP01.severity = error` (атрибут `CodeIssueKind` удалён в v2.0 — управление severity теперь как у любого Roslyn-анализатора)
Почему: warning не остановит merge. Архитектурное правило, которое не фейлит билд, нарушат при первом же дедлайне

## CI-gates: форматирование и покрытие

### Форматирование держится «на честном слове»
Плохо: стиль кода договорённость, но в CI нет проверки — формат расходится от ревьюера к ревьюеру
Правильно: gate `dotnet format --verify-no-changes` (ненулевой exit при расхождении с `.editorconfig`); опционально подкоманды `whitespace` / `style` для узких прогонов
Почему: `dotnet format` форматирует по `.editorconfig`; без него — по дефолтам, несогласованно. Verify в CI = форматирование перестаёт быть предметом спора в ревью. Это отдельно от analyzers: ловит whitespace/usings/ordering, которые CA-правила не трогают

### Покрытие не измеряется или без порога
Плохо: тесты есть, но coverage никто не считает, либо считает «для галочки» без gate
Правильно: `dotnet test --collect:"XPlat Code Coverage"` (Coverlet) → `ReportGenerator` с `minimumCoverageThresholds` (например line=80); падение ниже порога фейлит pipeline
Почему: покрытие без порога — метрика, которая только снижается. Gate фиксирует планку и не даёт новому коду приходить без тестов. Целиться в порог на **дельте**, а не на всём legacy сразу
> Сами тесты, фикстуры, антипаттерны — см. dex-skill-dotnet-testing-patterns

## Чек-лист

- `EnableNETAnalyzers` + `AnalysisMode` — в `Directory.Build.props`, не россыпью по .csproj
- IDE-правила нужны в CI → `EnforceCodeStyleInBuild=true`
- Варнинги фейлят билд (`TreatWarningsAsErrors=true` охватывает и компилятор, и CA) или хотя бы новые в CI
- Подавление варнинга — точечное, с `Justification` / комментарием, не глобальный `NoWarn` категориями
- `NuGetAuditMode=all` (транзитивные тоже); NU1901-1904 не заглушены
- CI-gate: `dotnet list package --vulnerable --include-transitive` + `--deprecated`
- NsDepCop: есть `config.nsdepcop`, build action верный, NSDEPCOP01 поднят до `error`
- CI: `dotnet format --verify-no-changes` как gate
- CI: coverage с порогом (Coverlet + ReportGenerator `minimumCoverageThresholds`), планка на дельте
