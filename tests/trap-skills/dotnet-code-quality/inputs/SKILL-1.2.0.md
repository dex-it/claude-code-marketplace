---
name: dotnet-code-quality
description: "Гигиена качества .NET-проекта - warning-профиль билда, AnalysisMode против .editorconfig, режим NuGet-аудита, контроль слоёв. Активируется при варнинги копятся, TreatWarningsAsErrors, AnalysisMode, editorconfig категории, NuGetAudit, NuGetAuditMode, транзитивные уязвимости, NSDepCop, нарушение слоёв, строгая сборка"
---

# .NET code quality - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- `AnalysisMode` в свойствах проекта при bulk-настройке категорий в `.editorconfig`
- Предупреждения не роняют сборку
- Режим NuGet-аудита не покрывает транзитивные пакеты
- Слои без контроля графа зависимостей
- Нарушение зависимости слоёв не роняет сборку
