---
description: Умная сборка .NET проекта с детальным анализом ошибок
allowed-tools: Bash, Read, Grep, Glob
---

# /build

Умная сборка .NET проекта с детальным анализом ошибок.

## Процесс

1. **Найти solution или project:**
```bash
sln=$(find . -maxdepth 2 -name "*.sln" | head -n 1)
if [ -z "$sln" ]; then
  target=$(find . -maxdepth 2 -name "*.csproj" | head -n 1)
else
  target="$sln"
fi
```

2. **Запустить сборку:**
```bash
dotnet build "$target" --configuration Release --no-incremental
```

3. **Анализ ошибок:**

- **CS0246** (тип не найден) - Проверить using директивы, возможно нужен NuGet пакет
- **CS0103** (имя не существует) - Проверить опечатки, импорты
- **CS8600** (nullable warning) - Добавить null-check или ! operator
- **CS1061** (метод не найден) - Проверить версию библиотеки, правильность вызова
- **CS0029** (несоответствие типов) - Проверить приведение типов

4. **Вывод:**
```
Сборка успешна за 3.2с

Warnings: 2
- CS8618: Nullable property 'Name' not initialized (Product.cs:15)
  Решение: Добавить инициализацию или сделать nullable: string?

- CS8602: Possible null reference (OrderService.cs:42)
  Решение: Добавить null-check: if (order != null)
```

## Интеграция

При обнаружении ошибок:
- Использовать GitLab MCP для проверки последних изменений
- Предложить исправления с примерами кода
- Создать задачу в GitLab при критических ошибках
