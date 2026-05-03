---
description: Компактный обзор репозитория — стек, размер, top-level модули
allowed-tools: Bash, Read, Grep, Glob
---

# /codebase-summary

Дать компактное описание репозитория, по которому архитектор поймёт стек, масштаб и структуру до проектирования.

**Goal:** Зафиксировать стек (язык, основной фреймворк, build-tooling), размер (LoC по языкам, число модулей/проектов), top-level организацию (монорепо/single, основные директории и их назначение).

**Output:** Markdown-блок со слотами:

- **Stack:** язык + фреймворк + build (например, «.NET 8 + ASP.NET Core + MSBuild с CPM»)
- **Size:** LoC по языкам, число файлов, число проектов
- **Top-level layout:** список основных директорий с одной фразой про каждую
- **Architecture style:** monolith / modular monolith / microservices / library — определить по структуре
- **Notable manifests:** что найдено (`Directory.Build.props`, `pnpm-workspace.yaml`, `pyproject.toml`, `go.work` и т.п.)

**Scenarios:**

- Если установлен `scc` — использовать для метрик LoC/COCOMO
- Если `scc` нет — fallback на `find` + `wc -l` по основным расширениям
- Парсить корневой манифест проекта (`*.sln`, `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`) для определения стека
- Для `.NET`: дополнительно `dotnet sln list` для перечня проектов

**Constraints:**

- Не читать файлы целиком — только метаданные и заголовки
- Не делать deep-dive по коду — это работа архитектора в Phase 0 Codebase Priming
- Если репо явно пустое — вернуть «greenfield, нечего анализировать» вместо заполнения слотов нулями
