---
name: dotnet-testing-patterns
description: .NET unit-тестирование — xUnit, Moq, антипаттерны. Активируется при unit test, xunit, moq, test coverage, mock, stub, fixture, assert, AAA pattern, Theory, InlineData, MemberData, flaky test, тест падает, Verify, Arrange Act Assert
---

# Testing Patterns — ловушки

## Unit тесты

### Тест проверяет реализацию, а не поведение
Плохо: `_mockRepo.Verify(r => r.AddAsync(It.IsAny<Order>(), ...), Times.Once)` — ломается при рефакторинге
Правильно: проверяй результат: `Assert.Equal(request.CustomerId, result.Value.CustomerId)`
Почему: переименовал метод репозитория → тест красный, хотя поведение не изменилось. Тест = контракт поведения, не реализации

### Assert.True вместо конкретного assert
Плохо: `Assert.True(result.Name == "Expected")` — сообщение "Assert.True() Failure"
Правильно: `Assert.Equal("Expected", result.Name)` — "Expected: Expected, Actual: Wrong"
Почему: при падении теста бесполезное сообщение. Разработчик открывает тест чтобы понять что пошло не так

### Цепочка моков (mock returns mock)
Плохо: `mockUoW.Setup(u => u.Orders).Returns(mockRepo.Object)` → 5 строк setup для одного теста
Правильно: если setup > 3 строк — признак плохого дизайна тестируемого кода, не теста
Почему: UnitOfWork с 10 репозиториями = god object. Рефакторинг кода упрощает тесты

### Тест зависит от внешнего состояния
Плохо: `var user = await _service.GetByIdAsync(42, ct)` — а кто создал user 42?
Правильно: тест создаёт свои данные: `var created = await _service.CreateAsync(...)` → проверяй created
Почему: другой тест удалил user 42, или БД пустая на CI → flaky test

### DateTime.Now в тестируемом коде
Плохо: `new Order { CreatedAt = DateTime.UtcNow }` → `Assert.Equal(expectedDate, order.CreatedAt)` — иногда падает
Правильно: `TimeProvider` (.NET 8) или `IClock` → `new FakeTimeProvider(fixedDate)` в тесте
Почему: время между arrange и act = несколько миллисекунд. На медленном CI — больше. Тест flaky

### Task.Delay / Thread.Sleep в тестах
Плохо: `await Task.Delay(2000)` — "подождём пока обработает"
Правильно: polling с timeout: `WaitForConditionAsync(() => GetStatus(), s => s == "Done", timeout: 10s)`
Почему: на медленном CI 2 секунд не хватит (false negative), на быстром — лишнее ожидание. Flaky в обе стороны

## Theory vs Fact

### Theory с нечитаемыми bool параметрами
Плохо: `[InlineData("admin", true, true, false)]` — что значат эти bool?
Правильно: отдельные `[Fact]` с говорящими именами: `Admin_CanEdit`, `Admin_CanDelete`, `Guest_NeedsApproval`
Почему: Theory хорош когда Arrange одинаковый и меняются только входные данные. Если логика разная — отдельные Fact читаемее

