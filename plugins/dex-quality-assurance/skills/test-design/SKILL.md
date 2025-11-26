---
name: test-design
description: Техники тест-дизайна для создания эффективных тест-кейсов. Активируется при equivalence partitioning, boundary values, decision table, state transition, pairwise testing, техники тестирования
allowed-tools: Read, Grep, Glob
---

# Test Design Techniques

Skill для применения техник тест-дизайна при создании тест-кейсов.

## 1. Equivalence Partitioning (Классы эквивалентности)

Разбиение входных данных на группы, где все значения ведут себя одинаково.

### Когда применять

- Поля с диапазонами значений
- Категории входных данных
- Множественные варианты выбора

### Пример

```
Поле: Возраст пользователя (для регистрации)

Классы эквивалентности:
1. < 0 (invalid)
2. 0-17 (invalid - несовершеннолетние)
3. 18-120 (valid)
4. > 120 (invalid)

Тест-кейсы (по 1 на класс):
TC-001: age = -5 → ошибка "Возраст не может быть отрицательным"
TC-002: age = 10 → ошибка "Минимальный возраст: 18 лет"
TC-003: age = 25 → успешная регистрация
TC-004: age = 150 → ошибка "Некорректный возраст"
```

### Шаблон анализа

```markdown
## Equivalence Partitioning для [Field Name]

**Valid Classes:**
1. [Description] - [Example value]
2. [Description] - [Example value]

**Invalid Classes:**
1. [Description] - [Example value]
2. [Description] - [Example value]

**Test Cases:**
- TC-XXX: [Value from class] → [Expected result]
```

## 2. Boundary Value Analysis (Граничные значения)

Тестирование значений на границах классов эквивалентности.

### Правило

Для диапазона [min, max] тестировать:
- min - 1 (invalid)
- min (valid)
- min + 1 (valid)
- max - 1 (valid)
- max (valid)
- max + 1 (invalid)

### Пример

```
Поле: Количество товара в заказе (1-100 шт)

Граничные значения:
0 (invalid), 1 (min), 2 (min+1),
50 (середина),
99 (max-1), 100 (max), 101 (invalid)

Тест-кейсы:
TC-001: quantity = 0 → ошибка "Минимум 1 шт"
TC-002: quantity = 1 → заказ создан
TC-003: quantity = 2 → заказ создан
TC-004: quantity = 100 → заказ создан
TC-005: quantity = 101 → ошибка "Максимум 100 шт"
```

### .NET специфика

```csharp
// Граничные значения для .NET типов
int.MinValue: -2,147,483,648
int.MaxValue: 2,147,483,647

decimal.MinValue: -79,228,162,514,264,337,593,543,950,335
decimal.MaxValue: 79,228,162,514,264,337,593,543,950,335

DateTime.MinValue: 01.01.0001 00:00:00
DateTime.MaxValue: 31.12.9999 23:59:59

// Тест-кейс для граничных значений decimal
[Theory]
[InlineData(decimal.MinValue)]
[InlineData(decimal.MaxValue)]
[InlineData(0)]
public void CalculateTotal_WithBoundaryValues_ShouldNotOverflow(decimal amount)
{
    // Test implementation
}
```

## 3. Decision Table (Таблица решений)

Комбинации условий и соответствующих действий.

### Когда применять

- Множество условий (if-else)
- Бизнес-правила с комбинациями
- Сложная логика принятия решений

### Пример: Скидка на заказ

```
Условия:
- Сумма заказа >= 5000 руб
- Пользователь - premium клиент
- Промокод применен

┌─────────────────────┬────────┬────────┬────────┬────────┬────────┬────────┬────────┬────────┐
│      Conditions     │ Rule 1 │ Rule 2 │ Rule 3 │ Rule 4 │ Rule 5 │ Rule 6 │ Rule 7 │ Rule 8 │
├─────────────────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│ Amount >= 5000      │   Y    │   Y    │   Y    │   Y    │   N    │   N    │   N    │   N    │
│ Premium customer    │   Y    │   Y    │   N    │   N    │   Y    │   Y    │   N    │   N    │
│ Promo code applied  │   Y    │   N    │   Y    │   N    │   Y    │   N    │   Y    │   N    │
├─────────────────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│      Actions        │        │        │        │        │        │        │        │        │
├─────────────────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│ Base discount       │  10%   │  10%   │  10%   │  10%   │   0%   │   0%   │   0%   │   0%   │
│ Premium bonus       │  +5%   │  +5%   │   0%   │   0%   │  +5%   │  +5%   │   0%   │   0%   │
│ Promo discount      │  +15%  │   0%   │  +15%  │   0%   │  +15%  │   0%   │  +15%  │   0%   │
│ Total discount      │  30%   │  15%   │  25%   │  10%   │  20%   │   5%   │  15%   │   0%   │
└─────────────────────┴────────┴────────┴────────┴────────┴────────┴────────┴────────┴────────┘

Тест-кейсы:
TC-001: 6000р + Premium + Promo → 30% скидка
TC-002: 6000р + Premium + No promo → 15% скидка
TC-003: 6000р + Regular + Promo → 25% скидка
... (8 тест-кейсов всего)
```

## 4. State Transition (Диаграмма состояний)

Тестирование переходов между состояниями объекта.

### Когда применять

- Объекты с жизненным циклом
- Workflow системы
- Конечные автоматы

### Пример: Статусы заказа

```
States: Draft → Pending → Processing → Shipped → Delivered
                  ↓           ↓
              Cancelled   Cancelled

Transitions:
1. Draft → Pending (Create)
2. Pending → Processing (Confirm)
3. Pending → Cancelled (Cancel)
4. Processing → Shipped (Ship)
5. Processing → Cancelled (Cancel)
6. Shipped → Delivered (Deliver)

Тест-кейсы (валидные переходы):
TC-001: Draft → Pending
TC-002: Pending → Processing
TC-003: Pending → Cancelled
TC-004: Processing → Shipped
TC-005: Shipped → Delivered

Тест-кейсы (невалидные переходы):
TC-006: Draft → Shipped (должна быть ошибка)
TC-007: Delivered → Pending (должна быть ошибка)
TC-008: Cancelled → Processing (должна быть ошибка)
```

### .NET реализация

```csharp
public enum OrderStatus
{
    Draft,
    Pending,
    Processing,
    Shipped,
    Delivered,
    Cancelled
}

public class Order
{
    public OrderStatus Status { get; private set; }

    public void Submit()
    {
        if (Status != OrderStatus.Draft)
            throw new InvalidOperationException($"Cannot submit from {Status}");

        Status = OrderStatus.Pending;
    }

    public void Cancel()
    {
        if (Status is OrderStatus.Shipped or OrderStatus.Delivered)
            throw new InvalidOperationException($"Cannot cancel from {Status}");

        Status = OrderStatus.Cancelled;
    }
}

// Тесты
[Fact]
public void Submit_FromDraft_ShouldChangeToPending()
{
    var order = new Order(); // Draft
    order.Submit();
    order.Status.Should().Be(OrderStatus.Pending);
}

[Fact]
public void Cancel_FromShipped_ShouldThrowException()
{
    var order = CreateShippedOrder();
    var act = () => order.Cancel();
    act.Should().Throw<InvalidOperationException>();
}
```

## 5. Pairwise Testing (Попарное тестирование)

Комбинации параметров для покрытия всех пар значений.

### Когда применять

- Много параметров конфигурации
- Тестирование комбинаций
- Сокращение числа тест-кейсов

### Пример: Тестирование UI форматирования

```
Параметры:
- OS: Windows, macOS, Linux
- Browser: Chrome, Firefox, Safari
- Language: EN, RU, DE

Полный перебор: 3 × 3 × 3 = 27 комбинаций

Pairwise coverage: 9 комбинаций

TC-001: Windows + Chrome + EN
TC-002: Windows + Firefox + RU
TC-003: Windows + Safari + DE
TC-004: macOS + Chrome + RU
TC-005: macOS + Firefox + DE
TC-006: macOS + Safari + EN
TC-007: Linux + Chrome + DE
TC-008: Linux + Firefox + EN
TC-009: Linux + Safari + RU
```

### Инструменты для генерации

```bash
# PICT (Microsoft)
dotnet tool install -g Microsoft.Pict

# pairwise.txt
OS: Windows, macOS, Linux
Browser: Chrome, Firefox, Safari
Language: EN, RU, DE

# Генерация
pict pairwise.txt > test-combinations.txt
```

## 6. Error Guessing (Предугадывание ошибок)

Основано на опыте: где обычно находятся баги?

### Типичные проблемные области

**1. Null/Empty значения**
```csharp
[Theory]
[InlineData(null)]
[InlineData("")]
[InlineData("   ")]
public void ProcessData_WithInvalidInput_ShouldThrow(string input)
{
    // Test null, empty, whitespace
}
```

**2. SQL Injection**
```csharp
[Fact]
public void Search_WithSqlInjection_ShouldNotExecute()
{
    var maliciousInput = "'; DROP TABLE Users; --";
    var result = await _service.SearchAsync(maliciousInput);
    // Должно быть безопасно обработано
}
```

**3. Переполнение буфера**
```csharp
[Fact]
public void AddComment_WithVeryLongText_ShouldHandleGracefully()
{
    var longText = new string('x', 1_000_000);
    var act = () => _service.AddCommentAsync(longText);
    // Должна быть валидация длины
}
```

**4. Race Conditions**
```csharp
[Fact]
public async Task UpdateBalance_Concurrent_ShouldBeThreadSafe()
{
    var tasks = Enumerable.Range(0, 100)
        .Select(_ => _service.DepositAsync(accountId: 1, amount: 10m))
        .ToArray();

    await Task.WhenAll(tasks);

    var balance = await _repository.GetBalanceAsync(1);
    balance.Should().Be(1000m); // 100 × 10
}
```

**5. Off-by-one errors**
```csharp
[Theory]
[InlineData(0)]     // First element
[InlineData(99)]    // Last element
[InlineData(100)]   // Out of bounds
public void GetItem_BoundaryIndexes_ShouldHandleCorrectly(int index)
{
    // Test array boundaries
}
```

## Применение техник в процессе

### Шаг 1: Анализ требований

```
Requirement: "Пользователь может заказать от 1 до 100 товаров"

Применяемые техники:
✅ Equivalence Partitioning (valid/invalid количество)
✅ Boundary Value Analysis (0, 1, 100, 101)
✅ Error Guessing (null, negative, non-integer)
```

### Шаг 2: Создание тест-кейсов

```
TC-001 (BVA): quantity = 0 → error
TC-002 (BVA): quantity = 1 → success
TC-003 (BVA): quantity = 100 → success
TC-004 (BVA): quantity = 101 → error
TC-005 (Error Guessing): quantity = -1 → error
TC-006 (Error Guessing): quantity = null → error
TC-007 (Error Guessing): quantity = 2147483648 (int overflow) → error
```

### Шаг 3: Оптимизация

```
Объединение тест-кейсов через Theory:

[Theory]
[InlineData(0, false, "Минимум 1 товар")]
[InlineData(1, true, null)]
[InlineData(100, true, null)]
[InlineData(101, false, "Максимум 100 товаров")]
[InlineData(-1, false, "Количество должно быть положительным")]
public void AddToCart_VariousQuantities_ShouldValidateCorrectly(
    int quantity,
    bool shouldSucceed,
    string expectedError)
{
    // Single test method, multiple scenarios
}
```

## Метрики покрытия

```
Test Coverage Metrics:

1. Requirement Coverage = (Tested requirements / Total requirements) × 100%
2. Code Coverage = (Executed lines / Total lines) × 100%
3. Decision Coverage = (Executed branches / Total branches) × 100%
4. Path Coverage = (Executed paths / Total paths) × 100%

Цели:
- Requirement Coverage: 100%
- Code Coverage: >80% (критичный код >90%)
- Decision Coverage: >70%
```

## Чек-лист выбора техники

```
☐ Есть диапазоны значений? → Boundary Value Analysis
☐ Есть категории входных данных? → Equivalence Partitioning
☐ Сложные бизнес-правила? → Decision Table
☐ Объект имеет статусы/состояния? → State Transition
☐ Много параметров конфигурации? → Pairwise Testing
☐ Известны типичные баги? → Error Guessing
☐ API с множеством endpoints? → API Testing patterns
```

## Best Practices

```
✅ DO:
- Комбинировать несколько техник
- Начинать с граничных значений
- Документировать применённые техники
- Создавать независимые тест-кейсы
- Использовать Theory для параметризации

❌ DON'T:
- Тестировать только happy path
- Игнорировать edge cases
- Создавать зависимые тест-кейсы
- Дублировать тест-кейсы
- Забывать про negative scenarios
```
