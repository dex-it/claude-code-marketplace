---
description: Анализ user story и генерация тест-кейсов
allowed-tools: Read, Write, Edit, Grep, Glob
argument-hint: [story-id или путь к файлу]
---

# /analyze-story

Команда для анализа user story и генерации тест-кейсов с применением техник тест-дизайна.

## Использование

```bash
/analyze-story                           # Интерактивный режим
/analyze-story US-123                    # По ID из GitLab
/analyze-story docs/stories/checkout.md  # Из файла
```

## Процесс анализа

### 1. Извлечение требований

Из user story извлекаются:
- **Acceptance Criteria** - критерии приемки
- **Business Rules** - бизнес-правила
- **Edge Cases** - граничные случаи
- **Dependencies** - зависимости

Пример user story:
```markdown
## US-123: Оформление заказа

**As a** покупатель
**I want** оформить заказ с выбором доставки
**So that** я могу получить товары

**Acceptance Criteria:**
- [ ] Можно выбрать способ доставки (курьер/самовывоз/почта)
- [ ] Стоимость доставки рассчитывается автоматически
- [ ] Минимальная сумма заказа: 1000 руб
- [ ] Email подтверждение отправляется после создания

**Business Rules:**
- Бесплатная доставка от 5000 руб
- Курьер доступен только в пределах МКАД
- Самовывоз из 3 точек выдачи
```

### 2. Применение техник тест-дизайна

#### Equivalence Partitioning

```
Поле: Сумма заказа

Классы эквивалентности:
1. < 1000 руб (invalid)
2. 1000-4999 руб (valid, платная доставка)
3. >= 5000 руб (valid, бесплатная доставка)

Тест-кейсы:
TC-001: 500 руб → ошибка "Минимальная сумма 1000 руб"
TC-002: 3000 руб → доставка 300 руб
TC-003: 5000 руб → доставка 0 руб
```

#### Boundary Value Analysis

```
Границы: 999, 1000, 1001, 4999, 5000, 5001

TC-004: 999 руб → invalid
TC-005: 1000 руб → valid, доставка 300 руб
TC-006: 1001 руб → valid, доставка 300 руб
TC-007: 4999 руб → valid, доставка 300 руб
TC-008: 5000 руб → valid, доставка 0 руб
TC-009: 5001 руб → valid, доставка 0 руб
```

#### Decision Table

```
┌────────────────┬─────────┬─────────┬───────────────────┐
│   Conditions   │ Rule 1  │ Rule 2  │      Rule 3       │
├────────────────┼─────────┼─────────┼───────────────────┤
│ Сумма >= 1000  │   Yes   │   Yes   │        No         │
│ Сумма >= 5000  │   No    │   Yes   │        -          │
│ Адрес в МКАД   │   Yes   │   Yes   │        -          │
├────────────────┼─────────┼─────────┼───────────────────┤
│   Actions      │         │         │                   │
├────────────────┼─────────┼─────────┼───────────────────┤
│ Создать заказ  │   Yes   │   Yes   │        No         │
│ Доставка       │  300р   │   0р    │        -          │
│ Email отправка │   Yes   │   Yes   │        No         │
└────────────────┴─────────┴─────────┴───────────────────┘
```

### 3. Генерация тест-кейсов

```markdown
## Test Case: TC-001 Создание заказа с минимальной суммой

**Story:** US-123
**Priority:** High
**Type:** Functional
**Level:** Integration

**Preconditions:**
- Пользователь авторизован
- В корзине товары на сумму 1000 руб
- Выбран адрес доставки в пределах МКАД

**Test Data:**
- Email: test.user@example.com
- Адрес: Москва, ул. Ленина, д. 1
- Товары: [Product1: 500р, Product2: 500р]

**Steps:**
1. Перейти в корзину (/cart)
2. Нажать "Оформить заказ"
3. Выбрать "Доставка курьером"
4. Подтвердить адрес
5. Нажать "Создать заказ"

**Expected Result:**
- Заказ создан с ID (ORDER-XXX)
- Сумма: 1000 руб + 300 руб доставка = 1300 руб
- Статус: "В обработке"
- Email отправлен на test.user@example.com
- Редирект на страницу успеха /order/success

**Test Technique:** Boundary Value Analysis
```

```markdown
## Test Case: TC-002 Бесплатная доставка от 5000 руб

**Story:** US-123
**Priority:** High
**Type:** Functional
**Level:** Integration

**Preconditions:**
- Пользователь авторизован
- В корзине товары на сумму 5500 руб

**Steps:**
1. Перейти в корзину
2. Нажать "Оформить заказ"
3. Выбрать "Доставка курьером"
4. Проверить расчет стоимости доставки

**Expected Result:**
- Стоимость доставки: 0 руб
- Общая сумма: 5500 руб
- Показывается badge "Бесплатная доставка"

**Test Technique:** Equivalence Partitioning
```

```markdown
## Test Case: TC-003 Заказ ниже минимальной суммы

**Story:** US-123
**Priority:** High
**Type:** Negative
**Level:** Integration

**Preconditions:**
- В корзине товары на 800 руб

**Steps:**
1. Перейти в корзину
2. Нажать "Оформить заказ"

**Expected Result:**
- Кнопка "Оформить заказ" disabled
- Показывается сообщение: "Минимальная сумма заказа 1000 руб. Добавьте еще товаров на 200 руб"
- Ссылка на каталог

**Test Technique:** Boundary Value Analysis (invalid)
```

### 4. Матрица покрытия

```markdown
## Requirements Traceability Matrix

| Requirement | Test Cases | Coverage | Status |
|-------------|------------|----------|--------|
| Выбор способа доставки | TC-001, TC-004, TC-005 | 100% | ✅ |
| Расчет стоимости | TC-001, TC-002, TC-006 | 100% | ✅ |
| Минимальная сумма 1000р | TC-003, TC-007 | 100% | ✅ |
| Email подтверждение | TC-001, TC-002, TC-008 | 100% | ✅ |
| Бесплатная доставка 5000р+ | TC-002, TC-009 | 100% | ✅ |
| Курьер только в МКАД | TC-010, TC-011 | 100% | ✅ |

**Total Coverage:** 6/6 requirements (100%)
```

## Вывод

После выполнения команда создаёт:

1. **Файл с тест-кейсами:** `docs/test-cases/US-123-test-cases.md`
2. **RTM файл:** `docs/test-cases/US-123-rtm.md`
3. **Summary отчет:**

```
Test Cases Generated: 11
├─ Positive: 7
├─ Negative: 3
└─ Boundary: 4

Coverage:
├─ Requirements: 6/6 (100%)
├─ Business Rules: 4/4 (100%)
└─ Edge Cases: 8/8 (100%)

Test Techniques Applied:
- Equivalence Partitioning: 4 test cases
- Boundary Value Analysis: 6 test cases
- Decision Table: 3 test cases

Priority Distribution:
- High: 8
- Medium: 3
- Low: 0

Next Steps:
1. Review test cases with team
2. Create GitLab issues: /create-test-issues US-123
3. Automate tests: /create-tests US-123
```

## Integration с GitLab

```bash
# Загрузить story из GitLab
mcp__gitlab_get_issue(issue_id=123)

# Создать test case issues
mcp__gitlab_create_issue(
  title="[TEST] TC-001: Создание заказа с минимальной суммой",
  description="...",
  labels=["test-case", "us-123"]
)

# Линковать с user story
mcp__gitlab_link_issues(123, 456)
```

## Best Practices

```
✅ DO:
- Покрывать позитивные и негативные сценарии
- Применять минимум 2 техники тест-дизайна
- Использовать реалистичные test data
- Создавать независимые тест-кейсы
- Указывать приоритет для каждого TC

❌ DON'T:
- Создавать тест-кейсы без анализа требований
- Пропускать граничные значения
- Делать зависимые тест-кейсы
- Использовать prod данные в тестах
- Дублировать тест-кейсы
```

## Примеры использования

```bash
# Анализ story из GitLab
/analyze-story US-123

# Анализ локального файла
/analyze-story docs/user-stories/payment.md

# С указанием типов тестов
/analyze-story US-123 --types functional,negative,boundary

# С генерацией автотестов
/analyze-story US-123 --auto-generate-tests
```
