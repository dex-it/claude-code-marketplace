---
description: Умная сборка .NET проекта с детальным анализом ошибок
allowed-tools: Bash, Read, Grep, Glob
---

# /build

**Goal:** Собрать .NET проект и проанализировать ошибки/warnings.

**Output:** Результат сборки (успех/неуспех, время). При ошибках: код ошибки, файл:строка, описание, предполагаемое исправление. При warnings: группировка по типу, рекомендации для критичных (nullable, obsolete).

## Действия

- Найти solution (`.sln`) или project (`.csproj`)
- Запустить `dotnet build --configuration Release --no-incremental`
- При ошибках: показать контекст ошибки и предложить исправление
- При warnings: сгруппировать по типу, предложить исправления для критичных (nullable, obsolete)

## Notes

- Предпочитать сборку solution, если есть `.sln`
- При ошибках зависимостей -- предложить `dotnet restore`
