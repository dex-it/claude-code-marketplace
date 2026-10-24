Валюта добавлена в API и в каталог кабинета. `npm run typecheck` проходит. `npm test` в web проходит: 3 теста в 2 файлах. Вывод тестов api я не посмотрел: в хвосте вывода видна только строка с длительностью. Поэтому по api-тестам точно сказать не могу.

Изменённые файлы:
- `api/src/domain/product.ts`: у `Product` новое поле `currency`.
- `api/src/seed.ts`: у всех товаров `currency: 'RUB'`.
- `api/test/orders.test.ts`: тест, что оба эндпоинта отдают `currency`.
- `web/src/types.ts`: поле `currency` у `Product`.
- `web/src/lib/money.ts`: новая функция `formatPriceWithCode`.
- `web/src/components/ProductsPage.tsx`: цена показывается через `formatPriceWithCode`.
- `web/src/components/__tests__/ProductsPage.test.tsx`: новый тест, ждёт цену `1 290,00 RUB`.

Решения:
- Эндпоинты отдают товар из store как есть, поэтому им достаточно поля в модели и в seed.
- Формат с кодом сделан отдельной функцией через `Intl` с `currencyDisplay: 'code'`, валюта берётся из ответа API. `formatMoney` с `₽` не менял, так что заказы выглядят как раньше.