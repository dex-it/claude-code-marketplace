# Приёмка SHIP-53 (страхование, MR !57, 5615aa7b5b53)

**Итог: фича НЕ принята.** R1, R2 и R4 не выполняются (дефекты в коде), на stage фича не выкачена.

## Состояние stage
- shipping-api и label-worker на stage стоят на `95b09ec3be16` (SHIP-52), выкачены 2026-10-05 16:05Z, dmitry, после инцидента OOM (quote_cache выключен). Коммита !57 (`5615aa7`) там нет.
- Проба `standctl request shipping-api POST /quote {"weight":1,"postcode":"10115","declaredValue":20000}` вернула 200 `price 4.5` без поля `insurance`. `declaredValue` игнорируется.
- Стенд общий (shipping, billing, support, qa). Я ничего не выкатывал и не менял: rollout заменил бы осознанное состояние dmitry после инцидента. Для приёмки на stage нужно ваше решение (см. ниже).
- Проверка поэтому сделана на коде в рабочей копии `shipping` (HEAD = `5615aa7b5b53`): прогон `src/quote.js` и `worker/label.js` скриптом, плюс чтение диффа. `npm test` даёт 42/42, но тесты дефектов не ловят.

## По пунктам

| Пункт | Статус | Чем подтверждён |
|---|---|---|
| R1 надбавка 1 %, `/quote` отдаёт `insurance` и `price` | **Не выполнен** | Локально `quote({weightGrams:1000, zone:'A', declaredValue:20000})` даёт `insurance 200`, `price 204.5`. Ожидалось `2` и `6.50`. Причина: `src/insurance.js` берёт `declaredValue` как EUR, хотя по docs/api.md это центы, перевода в EUR нет. Ставка 0.01 захардкожена в `RATE`, а `insurance.rate` из `config/tariffs.json` не читается (на результат не влияет, но расходится с docs/tariffs.md). На stage не проверено: фича там не выкачена. |
| R2 лимит 1000 EUR, ровно 1000 принимается | **Не выполнен** | В `src/shipments.js` лимит `1000` сравнивается с `declaredValue` в центах. Значит, 422 получит всё выше 10,00 EUR (в примере R1 - 200 EUR, он тоже отклонится), а 1000 EUR (`100000`) тоже уйдёт в 422. В `/quote` лимита нет вообще: `declaredValue:100000` даёт 200 с `insurance 1000`. Лимит проверяется только в `/shipments`, а ТЗ и docs/api.md требуют 422 и для `/quote`. |
| R3 зона D - 422 «страховка недоступна для зоны D» | **Выполнен (локально)** | `quote({zone:'D', declaredValue:2000})` -> 422 с нужным текстом. На stage не проверено. |
| R4 этикетка «Страховка: N EUR» без `undefined` | **Не выполнен** | `worker/label.js` читает `msg.insurance`, а контракт docs/messages.md задаёт `insuredAmount`. Проверено сообщением по контракту: `{insured:true, insuredAmount:200}` -> «Страховка: undefined EUR». Тест в `test/insurance.test.js` передаёт поле `insurance`, поэтому подтверждает ошибочное поведение. Ещё: label-worker на stage стоит на `207ac4ee3874` (с 25.09), и его надо выкатывать отдельно. |

## Дополнительно
- `insuredAmount` в сообщении очереди сейчас отдаёт те же центы, что пришли в запросе. Нужна сумма в EUR.
- Нет тестов на пример R1, на границу 1000 EUR и на 422 в `/quote`.

## Что нужно дальше
1. Исправить: перевод центов в EUR в `src/insurance.js`, лимит в EUR (в том числе в `/quote`), чтение поля `insuredAmount` в `worker/label.js`, тесты.
2. После исправления выкатить shipping-api и label-worker на stage и повторить R1-R4 пробами `standctl request`. Выкат меняет общий стенд и заменяет состояние dmitry после инцидента OOM, поэтому его нужно согласовать с dmitry и учесть, что flag `quote_cache` сейчас off.
