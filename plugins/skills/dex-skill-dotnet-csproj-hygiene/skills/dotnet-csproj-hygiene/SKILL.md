---
name: dotnet-csproj-hygiene
description: MSBuild csproj — гигиена зависимостей, CPM, analyzers. Активируется при csproj, PackageReference, ProjectReference, Directory.Packages.props, Directory.Build.props, CPM, PrivateAssets, analyzer, source generator, транзитивная зависимость
---

# MSBuild csproj — ловушки и anti-patterns

## PackageReference

### Явная зависимость поверх транзитивной
Плохо: проект добавляет `<PackageReference Include="X">` напрямую, хотя уже получает X через транзитивный граф от другого пакета
Правильно: опираться на транзитивную версию; добавлять явную ссылку только если проект **напрямую использует** типы из пакета в своём коде
Почему: дублирование версий в разных точках — риск рассинхронизации при обновлении; скрытие реального потребителя пакета; усложнение удаления фичи (остаётся висячая ссылка). Проверка: удали ссылку → `dotnet build`; если собирается — ссылка была лишней

### Версия пакета в .csproj при включённом CPM
Плохо: `<PackageReference Include="Serilog" Version="3.1.1" />` в проекте, где в репозитории есть `Directory.Packages.props`
Правильно: `<PackageReference Include="Serilog" />` без Version; версия — централизованно в `Directory.Packages.props`
Почему: CPM предполагает **одну** точку истины для версий. Versions в .csproj игнорируются или приводят к warning'ам `NU1507` и рассогласованию — один проект тянет одну версию, другой — другую, в одном решении

### PrivateAssets забыт для analyzers / source generators
Плохо: `<PackageReference Include="Microsoft.CodeAnalysis.Analyzers" Version="3.11.0" />` без `PrivateAssets`
Правильно: `<PackageReference Include="..." PrivateAssets="all" />` для анализаторов и source-генераторов
Почему: без `PrivateAssets="all"` analyzer становится runtime-зависимостью downstream-пакетов и попадает в их bin/nupkg. Это раздувает пакеты консьюмеров и ломает их analyzer chain

### Pre-release / range version без обоснования
Плохо: `Version="[6.0.0,)"` или `Version="8.0.0-preview.2"` в production-пакете
Правильно: точная версия либо аккуратный `[6.0.0, 7.0.0)` с обоснованием в комментарии / ADR
Почему: open-range тянет непроверенные мажорные обновления в production build. Preview версии имеют breaking changes между релизами. Оба варианта — скрытый детерминированности build

## ProjectReference

### ProjectReference без прямого использования типов
Плохо: `<ProjectReference Include="..\SharedInfra\SharedInfra.csproj" />` при том, что проект не использует типы SharedInfra напрямую (только транзитивно)
Правильно: удалить ссылку; транзитивная ссылка через промежуточный проект достаточна
Почему: лишняя ProjectReference делает граф сборки плотнее, замедляет инкрементальные билды и привязывает лишние проекты к рестарту тестов. Проверка: удали ссылку → `dotnet build`; если собирается — ссылка была лишней

### Circular ProjectReference через transitive
Плохо: `A` → `B` → `C`, при этом `C` ссылается на `A` (не напрямую, через transitive)
Правильно: выделить общий контракт в отдельный проект (`Contracts`), от которого зависят все участники
Почему: MSBuild detect'ит циклы и падает. Через transitive цикл может проявиться не сразу — только при попытке собрать `C` изолированно

## Directory.* инфраструктура

### Дубликаты Directory.Build.props на разных уровнях
Плохо: один `Directory.Build.props` на уровне `/`, ещё один в `/src/`, оба устанавливают одинаковые properties и не наследуются через `<Import Project="$([MSBuild]::GetPathOfFileAbove(...))">`
Правильно: единый source of truth; вложенный `Directory.Build.props` импортирует родительский первой строкой
Почему: MSBuild берёт **ближайший** `Directory.Build.props`; property из корневого не применяется к проектам ниже второго уровня без явного импорта. Property, который «должен работать везде», тихо не работает

### Property в .csproj вместо Directory.Build.props
Плохо: `<LangVersion>latest</LangVersion>` и `<Nullable>enable</Nullable>` скопированы в каждый .csproj репозитория
Правильно: общие свойства — в корневом `Directory.Build.props`; в .csproj — только специфичные для проекта
Почему: копипаста в N проектах = N точек для обновления; расхождение между проектами (один на LangVersion 11, другой на 12) создаёт тихие баги и разные warning-профили

### Central Package Management частично включён
Плохо: `Directory.Packages.props` создан, но `ManagePackageVersionsCentrally` не установлен в `true`, либо установлен, но часть проектов по-прежнему с version в .csproj
Правильно: `<ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>` + все проекты используют `PackageReference` без Version
Почему: частичный CPM даёт ложное ощущение централизации. Проекты с version в .csproj игнорируют Directory.Packages.props, что приводит к рассогласованию версий в одном решении

## Output / build artifacts

### OutputPath / IntermediateOutputPath вручную в .csproj
Плохо: `<OutputPath>..\..\bin\</OutputPath>` и `<IntermediateOutputPath>obj\custom\</IntermediateOutputPath>` в каждом проекте
Правильно: оставить defaults; переопределять — только в `Directory.Build.props` централизованно при реальной необходимости
Почему: MSBuild рассчитывает параллелизм и clean на основании стандартных путей. Кастомные пути приводят к конфликтам в параллельной сборке и оставляют артефакты после `dotnet clean`

### Обобщённое .dll копирование через CopyLocalLockFileAssemblies
Плохо: `<CopyLocalLockFileAssemblies>true</CopyLocalLockFileAssemblies>` в библиотеке без конкретной необходимости
Правильно: включать флаг только в startup-проектах или там, где нужна именно такая схема deployment
Почему: флаг копирует все transitive зависимости в output, раздувая библиотеку и увеличивая поверхность конфликтов версий у потребителей

## Чек-лист

- Новая `PackageReference` — проект напрямую использует типы из пакета?
- При включённом CPM: все `PackageReference` без Version, `ManagePackageVersionsCentrally=true`
- Analyzers / source generators — с `PrivateAssets="all"`
- Новая `ProjectReference` — проект использует типы оттуда напрямую (не транзитивно)?
- Directory.Build.props на вложенных уровнях импортирует родительский
- Общие properties (LangVersion, Nullable) — в Directory.Build.props, не копипастой
- OutputPath / IntermediateOutputPath не переопределены без необходимости
