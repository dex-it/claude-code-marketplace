---
description: Помощь в отладке - анализ stack trace, логов, исключений
allowed-tools: Read, Grep, Glob, Bash
argument-hint: [stack-trace или описание ошибки]
---

# /debug

**Goal:** Найти root cause ошибки по stack trace, логам или описанию исключения и предложить исправление.

**Scenarios:**

- Stack trace / exception -- открыть файл на указанной строке, найти причину, предложить fix
- Медленный запрос -- проверить N+1, предложить Include/projection
- Ошибки в логах -- найти паттерн, корреляция по request ID

**Output:**

- Файл и строка с проблемой
- Root cause (что именно вызывает ошибку)
- Исправление с объяснением почему
- Рекомендация по unit-тесту для кейса

**Constraints:**

- Начинать с файла/строки из stack trace, не гадать
- Предлагать null-check, guard clause или валидацию на входе
- При N+1 предлагать Include, projection или batch-запрос
