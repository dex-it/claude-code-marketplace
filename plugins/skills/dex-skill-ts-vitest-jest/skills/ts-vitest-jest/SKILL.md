---
name: ts-vitest-jest
description: Vitest/Jest unit-тесты - переменная в factory мока и hoisting. Активируется при vitest, jest, vi.mock, jest.mock, vi.hoisted, vi.fn, jest.fn, mock factory, hoisting, ReferenceError Cannot access before initialization, мок не подхватывается
---

# Vitest / Jest - ловушки unit-тестирования

### Переменная в factory мока - недоступна из-за hoisting
Плохо: `const fn = vi.fn(); vi.mock('./api', () => ({ get: fn }))` -> `ReferenceError: Cannot access 'fn' before initialization`
Правильно: `const { fn } = vi.hoisted(() => ({ fn: vi.fn() })); vi.mock('./api', () => ({ get: fn }))`
Почему: `vi.mock`/`jest.mock` всплывают в начало файла до объявлений. Factory выполняется раньше, чем создана переменная. `vi.hoisted` поднимает её вместе с моком
