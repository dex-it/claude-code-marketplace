---
name: bpmn
description: BPMN — ошибки моделирования, выбор gateway, ловушки. Активируется при bpmn, business process, workflow, swimlane, gateway
allowed-tools: Read, Grep, Glob
---

# BPMN — ловушки моделирования

## Правила

- Каждый Split gateway должен иметь Join (баланс)
- Sequence flow НЕ пересекает границы Pool (используй Message flow)
- Task naming: Глагол + Существительное ("Approve Order", не "Order")
- Max 15-20 элементов на диаграмме (иначе — Sub-Process)
- Все пути должны вести к End Event (нет висячих веток)

## Частые ошибки

### 1. Неправильный выбор Gateway

```
Плохо: XOR gateway для параллельных задач
  <XOR>
    → Send Email
    → Update Inventory
    → Log Activity
// XOR = только ОДИН путь! Email отправится, но inventory не обновится

Хорошо: AND gateway для параллельных задач
  <AND Split>
    → Send Email
    → Update Inventory
    → Log Activity
  <AND Join>
// Все три выполнятся параллельно

Плохо: AND gateway для условного выбора
  <AND>
    → [< $100] → Standard Shipping
    → [>= $100] → Free Shipping
// AND = ОБА пути! Отправим и Standard, и Free одновременно

Хорошо: XOR gateway для условного выбора
  <XOR: Amount?>
    → [< $100] → Standard Shipping
    → [>= $100] → Free Shipping
```

| Нужно | Gateway | НЕ используй |
|-------|---------|--------------|
| If-else (один путь) | XOR | AND (выполнит все) |
| Параллельно (все пути) | AND | XOR (выполнит один) |
| Условно несколько путей | OR | XOR (только один) |
| Первое событие побеждает | Event-Based | XOR (не ждёт события) |

### 2. Несбалансированные gateway

```
Плохо:
  <AND Split>
    → Task A →
    → Task B → [End]   ← один путь уходит в End, другой висит
    → Task C →

Хорошо:
  <AND Split>
    → Task A →
    → Task B →  <AND Join> → [End]
    → Task C →
```

### 3. Sequence flow через границу Pool

```
Плохо:
  ║ Customer        ║
  ║ [Place Order] ──→──┐  ← Sequence flow пересекает Pool!
  ║                 ║  │
  ║ Order System    ║  │
  ║              ←──┘ [Process] ║

Хорошо:
  ║ Customer        ║
  ║ [Place Order] ──╌╌→  ← Message flow (dashed) между Pools
  ║                 ║
  ║ Order System    ║
  ║ [Receive] → [Process] ║
```

### 4. Только happy path

```
Плохо:
  [Start] → (Process Payment) → (Ship Order) → [End]
  // А если оплата не прошла? Товар закончился?

Хорошо:
  [Start] → (Process Payment)
              ↓ [Error: Payment Failed]
              → (Notify Customer) → [Error End]
            ↓ [Success]
            → (Check Inventory)
              ↓ [Out of Stock]
              → (Refund) → [Error End]
            ↓ [In Stock]
            → (Ship Order) → [End]
```

### 5. Vague task names

```
Плохо: "Process Data", "Handle Request", "Do Stuff"
Хорошо: "Calculate Order Total", "Validate Customer Address", "Send Invoice Email"
```

## Чек-лист

- [ ] Каждый Split имеет Join
- [ ] Sequence flow не пересекает Pool boundaries
- [ ] Task names: Verb + Noun
- [ ] Error/exception paths смоделированы
- [ ] Все пути ведут к End Event
- [ ] Max 15-20 элементов на диаграмме
- [ ] XOR для if-else, AND для параллельности, OR для multiple conditions
- [ ] Message flow (dashed) между Pools, Sequence flow внутри
