---
name: ts-vitest-jest
description: Vitest/Jest unit-тестирование — ловушки моков, таймеров, async, изоляции. Активируется при vitest, jest, unit test, vi.mock, jest.mock, mock, spy, fake timers, useFakeTimers, beforeEach, afterEach, resolves, rejects, тест падает, flaky test, mockReturnValue, toHaveBeenCalled
---

# Vitest / Jest — ловушки unit-тестирования

> API Vitest (`vi.*`) и Jest (`jest.*`) зеркальны — ловушки одинаковы, имена в примерах через `vi.`. Для E2E (network mocking, browser isolation) → `dex-skill-playwright`.

## Моки модулей

### Переменная в factory мока — недоступна из-за hoisting
Плохо: `const fn = vi.fn(); vi.mock('./api', () => ({ get: fn }))` → `ReferenceError: Cannot access 'fn' before initialization`
Правильно: `const { fn } = vi.hoisted(() => ({ fn: vi.fn() })); vi.mock('./api', () => ({ get: fn }))`
Почему: `vi.mock`/`jest.mock` всплывают в начало файла до объявлений. Factory выполняется раньше, чем создана переменная. `vi.hoisted` поднимает её вместе с моком

### Мок не сброшен между тестами
Плохо: `mockFn.mockReturnValue(1)` в одном тесте → следующий тест видит ту же заглушку и `toHaveBeenCalledTimes` накопленный
Правильно: конфиг `clearMocks: true` сбрасывает историю вызовов; `restoreMocks: true` дополнительно возвращает оригинальную реализацию (нужен для `spyOn`)
Почему: моки хранят состояние (вызовы, реализацию) между тестами. Один тест «протекает» в другой → порядок тестов меняет результат, flaky. `clearMocks` не вернёт реальную реализацию у `spyOn` — для этого `restoreMocks`

### Мок реализации вместо spy на реальном
Плохо: `vi.mock('./logger')` целиком, когда нужно лишь проверить факт вызова одного метода
Правильно: `vi.spyOn(logger, 'warn')` — реальная реализация работает, вызов отслеживается
Почему: полный мок модуля убирает настоящее поведение → тест проходит, а интеграция сломана. spy наблюдает, не подменяя

## Fake timers

### useFakeTimers без восстановления
Плохо: `vi.useFakeTimers()` в тесте без `vi.useRealTimers()` → следующие тесты с таймаутами зависают
Правильно: `beforeEach(() => vi.useFakeTimers())` + `afterEach(() => vi.useRealTimers())`
Почему: fake timers глобальны. Не вернул реальные — `setTimeout`/`await` в других тестах не срабатывают, suite виснет

### Реальное ожидание вместо продвижения времени
Плохо: `await new Promise(r => setTimeout(r, 2000))` — «подождём пока сработает debounce»
Правильно: `vi.useFakeTimers(); trigger(); vi.advanceTimersByTime(2000)` — время виртуальное, мгновенно
Почему: реальный sleep делает тест медленным и flaky на загруженном CI. Fake timers двигают время детерминированно

## Async assertions

### resolves/rejects без await
Плохо: `expect(fetchUser()).resolves.toEqual(user)` — без await тест зелёный, даже если промис отвергнут
Правильно: `await expect(fetchUser()).resolves.toEqual(user)`
Почему: `resolves`/`rejects` возвращают промис. Без await assertion не дожидается → ложно-зелёный тест, баг не ловится

### Тест на ошибку без гарантии, что assertion выполнился
Плохо: `try { await act() } catch (e) { expect(e.message).toBe('x') }` — не бросил → catch не вызван, тест зелёный
Правильно: `await expect(act()).rejects.toThrow('x')` или `expect.assertions(1)` в начале теста
Почему: если код перестал бросать, ветка catch не выполнится и проверка молча пропущена. `rejects`/`expect.assertions` фиксируют факт

### Assertion до завершения async-действия в тесте
Плохо: `act(); expect(store.value).toBe(1)` где `act` async → проверка до завершения
Правильно: `await act(); expect(store.value).toBe(1)`
Почему: без await assertion в тесте выполняется на незавершённом состоянии. Проходит случайно, падает при изменении тайминга

## Изоляция

### Общий mutable-стейт между тестами
Плохо: `const cache = new Map()` на уровне файла, тесты пишут в него → зависят от порядка
Правильно: создавай стейт в `beforeEach`, не на уровне модуля
Почему: модульный стейт переживает тесты. Запуск по одному зелёный, всем suite — красный (или наоборот). Классический flaky

### Тест проверяет реализацию мока, а не поведение
Плохо: `expect(repoMock.save).toHaveBeenCalledWith(exactDto)` — ломается при любом рефакторинге сигнатуры
Правильно: проверяй наблюдаемый результат: `expect(result.id).toBe(created.id)`
Почему: assertion на детали вызова мока = тест связан с реализацией, не контрактом. Переименовал поле → красный без смены поведения

## Чек-лист
- `vi.hoisted` для переменных в factory мока
- `restoreMocks`/`clearMocks` между тестами (конфиг или afterEach)
- `vi.useRealTimers()` в afterEach после fake timers
- `await` перед `expect(...).resolves/.rejects`
- Стейт в `beforeEach`, не на уровне модуля
- Assert по результату, не по `toHaveBeenCalledWith` деталям
