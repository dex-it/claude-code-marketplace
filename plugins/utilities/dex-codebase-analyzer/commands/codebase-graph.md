---
description: Граф зависимостей модулей/проектов в виде Mermaid + текстового списка
allowed-tools: Bash, Read, Grep, Glob
argument-hint: "[--scope module|project|file]"
---

# /codebase-graph

Построить граф зависимостей внутри репозитория — какой модуль использует какие.

**Goal:** Визуализировать связи между модулями/проектами, чтобы архитектор увидел tight coupling, циклические зависимости, изолированные части и точки расширения.

**Output:** Mermaid-блок (`graph LR` с edges A → B) + текстовый список «module A зависит от B, C» с пометками cyclic / leaf / hub.

**Scenarios:**

- **.NET:** `dotnet list package --include-transitive` + `dotnet sln list` для NuGet-зависимостей; ProjectReference из `.csproj` — для внутренних
- **TypeScript / JavaScript:** `madge --circular --extensions ts,tsx,js,jsx .` или `dependency-cruiser` для импортов
- **Python:** `pydeps` или `pipdeptree` для модулей
- **Go:** `go mod graph`
- **Rust:** `cargo tree`
- **Универсальный fallback:** `ast-grep` по `import` / `require` / `using` для построения грубого графа
- `--scope module` (по умолчанию) — модули; `--scope project` — sln-проекты; `--scope file` — детальный файловый граф (только для small repos)

**Constraints:**

- Если ни одного из CLI-инструментов нет — fallback через `grep` для основных языков
- Не строить файловый граф для репо >1000 файлов без `--scope file` — слишком шумный
- Помечать циклы явно (🔴) — это сигнал архитектурной проблемы
- Если граф пустой (одиночный модуль) — вернуть «нет внутренних зависимостей» вместо пустого Mermaid
