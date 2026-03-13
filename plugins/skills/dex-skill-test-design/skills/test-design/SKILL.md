---
name: test-design
description: Техники тест-дизайна — ловушки и ошибки применения. Активируется при equivalence partitioning, boundary values, decision table, state transition, pairwise testing, техники тестирования
---

# Test Design — ловушки

## Правила

- Комбинируй техники — одна техника не покрывает все дефекты
- Начинай с Boundary Values — большинство багов на границах
- Negative сценарии обязательны — не только happy path
- Невалидные переходы состояний — тестируй что запрещённые переходы блокируются

## Частые ошибки

### Boundary Values — забытые границы

```
Поле: количество товара (1-100)

Плохо — тестируют только happy path:
TC-001: quantity = 5 → OK
TC-002: quantity = 50 → OK
// Баг на границе 0/1 и 100/101 не найден

Хорошо — BVA:
TC-001: quantity = 0 → error    (min-1)
TC-002: quantity = 1 → OK       (min)
TC-003: quantity = 100 → OK     (max)
TC-004: quantity = 101 → error  (max+1)
// + Error Guessing:
TC-005: quantity = -1 → error
TC-006: quantity = null → error
TC-007: quantity = 2147483648 → error (int overflow)
```

### Equivalence Partitioning — пропуск invalid классов

```
Плохо — только valid классы:
Возраст: 18-120 → тестируем age=25 ✓
// А что с -5? С 0? С 200? С "abc"? С null?

Хорошо — valid + все invalid классы:
1. < 0 (invalid)      → age = -5
2. 0-17 (invalid)     → age = 10
3. 18-120 (valid)     → age = 25
4. > 120 (invalid)    → age = 150
5. Не число (invalid) → age = "abc"
6. null (invalid)     → age = null
```

### State Transition — забыли невалидные переходы

```
States: Draft → Pending → Processing → Shipped → Delivered
                  ↓           ↓
              Cancelled   Cancelled

Плохо — тестируют только happy path:
TC-001: Draft → Pending ✓
TC-002: Pending → Processing ✓
TC-003: Processing → Shipped ✓
// Баг: Cancelled → Processing работает (а не должно!)

Хорошо — валидные + невалидные переходы:
// Валидные:
TC-001: Draft → Pending ✓
TC-002: Pending → Processing ✓
// Невалидные (должны блокироваться):
TC-006: Draft → Shipped → error ✓
TC-007: Delivered → Pending → error ✓
TC-008: Cancelled → Processing → error ✓
```

### Decision Table — неполная таблица

```
Условия: Premium + Сумма >= 5000 + Промокод

Плохо — только очевидные комбинации:
Premium + 5000 + Promo → 30%
Regular + 1000 + No promo → 0%
// Пропущены 6 из 8 комбинаций — баг в неочевидной

Хорошо — полная таблица 2^N:
3 условия = 8 комбинаций, каждая — тест-кейс
Иначе баг прячется в непроверенной комбинации
```

### Pairwise — когда НЕ использовать

```
Плохо — pairwise для критичной бизнес-логики:
Оплата: (тип карты × валюта × 3D-Secure × recurring)
Pairwise сокращает 54 → 12 комбинаций
// Но пропущенная комбинация = реальные деньги потеряны

Хорошо — pairwise только для UI/конфигурации:
(OS × Browser × Разрешение × Язык)
Pairwise: 81 → 9 комбинаций
// Баг в UI на одной комбинации — не критично
```

## Выбор техники

| Ситуация | Техника | НЕ используй |
|----------|---------|--------------|
| Поле с диапазоном | BVA + EP | Только random values |
| Бизнес-правила с условиями | Decision Table | Только happy path |
| Объект с жизненным циклом | State Transition | Только валидные переходы |
| Много параметров конфигурации | Pairwise | Полный перебор (взрыв) |
| Финансы, безопасность | Полный перебор | Pairwise (риск пропуска) |

## Чек-лист

- [ ] BVA: min-1, min, max, max+1 протестированы
- [ ] EP: все invalid классы покрыты (не только valid)
- [ ] State Transition: невалидные переходы тестируются
- [ ] Decision Table: полная таблица 2^N (не только очевидные)
- [ ] Error Guessing: null, пустая строка, overflow, спецсимволы
- [ ] Negative сценарии ≥ 50% от всех тест-кейсов
