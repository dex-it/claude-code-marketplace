---
name: dotnet-logging
description: .NET structured logging - уровень записи для штатной ситуации, отладки и шагов флоу, контекст через scope. Активируется при serilog, seq, ILogger, log level, LogWarning, LogInformation, BeginScope, correlation, шум в логах
---

# Logging - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- Warning для штатной ситуации, которую код обрабатывает
- Information для отладочных подробностей
- Information для шагов флоу внутри одной операции
- Один и тот же контекст в каждой строке вместо scope
