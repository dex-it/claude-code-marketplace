---
name: ts-vitest-jest
description: Vitest/Jest unit-тесты - фабрика мока и hoisting, мок модуля против spy, проверка вызовов мока вместо результата. Активируется при vitest, jest, vi.mock, jest.mock, vi.hoisted, mock, spy, spyOn, unit test, тест падает при рефакторинге, toHaveBeenCalledWith
---

# Vitest / Jest - ловушки unit-тестирования

### Переменная в factory мока - недоступна из-за hoisting
Плохо: `const fn = vi.fn(); vi.mock('./api', () => ({ get: fn }))` -> `ReferenceError: Cannot access 'fn' before initialization`
Правильно: `const { fn } = vi.hoisted(() => ({ fn: vi.fn() })); vi.mock('./api', () => ({ get: fn }))`
Почему: `vi.mock`/`jest.mock` всплывают в начало файла до объявлений. Factory выполняется раньше, чем создана переменная. `vi.hoisted` поднимает её вместе с моком

### Мок реализации вместо spy на реальном
Плохо: `vi.mock('./logger')` целиком, когда нужно лишь проверить факт вызова одного метода
Правильно: `vi.spyOn(logger, 'warn')` - реальная реализация работает, вызов отслеживается
Почему: полный мок модуля убирает настоящее поведение -> тест проходит, а интеграция сломана. spy наблюдает, не подменяя

### Тест проверяет реализацию мока, а не поведение
Плохо: `expect(repoMock.save).toHaveBeenCalledWith(exactDto)` - ломается при любом рефакторинге сигнатуры
Правильно: проверяй наблюдаемый результат: `expect(result.id).toBe(created.id)`
Почему: assertion на детали вызова мока = тест связан с реализацией, не контрактом. Переименовал поле -> красный без смены поведения
