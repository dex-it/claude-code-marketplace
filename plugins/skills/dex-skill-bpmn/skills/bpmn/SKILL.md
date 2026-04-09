---
name: bpmn
description: BPMN — ловушки моделирования, gateway, process flow. Активируется при bpmn, business process, workflow, swimlane, gateway, XOR, AND, OR, sequence flow, message flow, pool, lane, sub-process, end event, error boundary, process diagram
---

# BPMN — ловушки моделирования

## Gateway

### XOR для параллельных задач
Плохо: `<XOR> -> Send Email + Update Inventory + Log` — XOR выполнит только ОДИН путь
Правильно: `<AND Split> -> все три задачи -> <AND Join>` для параллельного выполнения
Почему: XOR = exclusive choice (один путь), AND = parallel (все пути). Email отправится, но inventory не обновится

### AND для условного выбора
Плохо: `<AND> -> [<$100] Standard Shipping + [>=$100] Free Shipping` — AND выполнит ОБА
Правильно: `<XOR: Amount?> -> [<$100] Standard + [>=$100] Free` — выбор одного пути
Почему: AND запускает все ветки, условия на линиях игнорируются. Отправят и Standard, и Free

### OR gateway вместо XOR
Плохо: `<XOR>` когда нужно выбрать НЕСКОЛЬКО путей по условиям
Правильно: `<OR>` (Inclusive gateway) — выполняет все пути, где условие true
Почему: XOR строго один путь. Если заказ может быть и urgent, и premium одновременно — нужен OR

### Event-Based gateway забыт
Плохо: `<XOR>` для ожидания первого из нескольких событий (таймер или сообщение)
Правильно: `<Event-Based>` — ждёт первое событие и выполняет только его ветку
Почему: XOR не умеет ждать события, Event-Based блокируется до наступления первого

## Структура

### Несбалансированные gateway
Плохо: `<AND Split> -> Task A + Task B -> [End]` — один путь уходит в End, другой висит
Правильно: каждый Split gateway имеет парный Join: `<AND Split> -> A + B + C -> <AND Join>`
Почему: процесс зависнет навсегда на Join, ожидая завершения "потерянной" ветки

### Sequence flow через границу Pool
Плохо: `[Place Order] ---> [Process]` — sequence flow между Customer и Order System pools
Правильно: Message flow (dashed line) между Pools, Sequence flow только внутри Pool
Почему: Pools = независимые участники (организации, системы). Sequence flow подразумевает единый контроль

### Висячие ветки без End Event
Плохо: ветка после gateway не ведёт ни к End Event, ни к другому элементу
Правильно: каждый путь в диаграмме должен заканчиваться End Event
Почему: висячая ветка = неопределённое состояние процесса, токен "теряется"

## Моделирование сценариев

### Только happy path
Плохо: `[Start] -> Process Payment -> Ship Order -> [End]` — без обработки ошибок
Правильно: Error Boundary Event на Payment: `[Error: Payment Failed] -> Notify -> [Error End]`
Почему: в реальности оплата отклоняется, товар заканчивается. Без error paths диаграмма бесполезна

### Vague task names
Плохо: `"Process Data"`, `"Handle Request"`, `"Do Stuff"` — абстрактные имена
Правильно: `"Calculate Order Total"`, `"Validate Customer Address"`, `"Send Invoice Email"`
Почему: Verb + Noun = конкретное действие. Vague names делают диаграмму нечитаемой

### Перегруженная диаграмма
Плохо: 30+ элементов на одной диаграмме
Правильно: max 15-20 элементов, вынести детали в Sub-Process (collapsed)
Почему: диаграмма перестаёт помещаться на экран, теряется обзорность

## Чек-лист

- Каждый Split имеет парный Join
- Sequence flow не пересекает Pool boundaries
- Task names: Verb + Noun
- Error/exception paths смоделированы
- Все пути ведут к End Event
- Max 15-20 элементов на диаграмме
- XOR для if-else, AND для параллельности, OR для multiple conditions
- Message flow (dashed) между Pools, Sequence flow внутри
