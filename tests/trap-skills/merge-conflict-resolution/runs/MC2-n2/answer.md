Ветка `feature/mc-rebase` перебазирована на актуальный `main` (`0102799`) локально. `npm test` в `tools/ordercli` прошёл: 4 теста из 4. Старых имён `formatMoney` и `legacyDiscount` в `src` и `test` не осталось, маркеров конфликта тоже.

Конфликты были в обоих коммитах фичи, оба в `tools/ordercli/src/cart.js`. Причина: в `main` переименовали `formatMoney` в `formatAmount` и добавили параметр `opts` в `summary`.
- **«Позиций вместо товаров»:** взял `formatAmount` и `opts` из `main`, а надпись «Позиций» из фичи.
- **«Строка доставки»:** строка `Доставка` теперь тоже использует `formatAmount(p.shipping)`.

Тест `pricing.test.js` слился без конфликта.

Конфликты в `docs/requirements`, `migrations` и `.req_counter` не потребовались, потому что фича их не меняла.

- **Откат:** до начала я создал точку отката `feature/mc-rebase-backup`.
- **Настройки:** `git config` записать не удалось, `.git/config` заблокирован песочницей. Поэтому `merge.conflictStyle=zdiff3` я передал флагом `-c` только на время rebase, а `rerere` не включал.
- **Проверка:** итоговый diff относительно `main` — только `cart.js` и `pricing.test.js`.

Push не делал, remote нет.