---
description: Запуск тестов с подробным анализом результатов и coverage
allowed-tools: Bash, Read, Grep, Glob
---

# /test

Запуск тестов с подробным анализом результатов и coverage.

## Процесс

1. **Найти тестовые проекты:**
```bash
test_projects=$(find . -name "*Tests.csproj" -o -name "*Test.csproj")
```

2. **Запустить тесты с coverage:**
```bash
dotnet test --no-build --verbosity normal --collect:"XPlat Code Coverage" --results-directory ./TestResults
```

3. **Анализ результатов:**

**Пройденные тесты:**
- Показать общее количество
- Время выполнения

**Упавшие тесты:**
- Имя теста
- Stack trace (сокращенный)
- Предполагаемая причина

**Code Coverage:**
- Общий процент покрытия
- Критические классы без покрытия

4. **Вывод:**
```
Тесты: 89 пройдено | 3 упало | 2 пропущено
Время: 12.4с
Coverage: 76%

Упавшие тесты:
1. ProductServiceTests.CreateProduct_WithInvalidPrice_ShouldThrow
   Ожидалось: ArgumentException
   Получено: null
   -> Проверить валидацию в ProductService.CreateProduct()

2. OrderTests.CalculateTotal_WithDiscount
   Ожидалось: 90.0
   Получено: 100.0
   -> Скидка не применяется, проверить DiscountService

Низкое покрытие:
- OrderService.cs: 45% (критично!)
- PaymentProcessor.cs: 60%
```

## Действия

- Показать код упавшего теста и тестируемого метода
- Предложить исправление
- Создать issue в GitLab при регрессии
- Сохранить результат в Notion для истории
