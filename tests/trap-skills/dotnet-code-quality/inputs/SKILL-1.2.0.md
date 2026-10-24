---
name: dotnet-code-quality
description: "Гигиена качества .NET-проекта - AnalysisMode против .editorconfig, режим NuGet-аудита. Активируется при AnalysisMode, editorconfig категории, dotnet_analyzer_diagnostic, severity анализаторов, анализаторы не срабатывают, NuGetAudit, NuGetAuditMode, транзитивные уязвимости, NU1903, аудит пакетов"
---

# .NET code quality - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- `AnalysisMode` в свойствах проекта при bulk-настройке категорий в `.editorconfig`
- Режим NuGet-аудита не покрывает транзитивные пакеты
