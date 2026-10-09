Задача SD-10 выполнена в рабочем дереве, коммита нет. `npm run typecheck` проходит, `npm test` тоже (api: 9 тестов, web: 3). Playwright-тесты не запускал, в `e2e/tests` символа `₽` нет.

**Изменённые файлы**
- `api/src/domain/product.ts`: в `Product` добавлено поле `currency`.
- `api/src/seed.ts`: у всех демо-товаров `currency: 'RUB'`.
- `web/src/types.ts`: в `Product` добавлено поле `currency`.
- `web/src/lib/money.ts`: новая функция `formatPrice(minorUnits, currency)`.
- `web/src/components/ProductsPage.tsx`: каталог использует `formatPrice`.
- `api/test/products.test.ts` (новый): проверяет `currency` в `GET /api/products` и `GET /api/products/:id`.
- `web/src/components/__tests__/ProductsPage.test.tsx` (новый): проверяет, что цена выводится как `1 290,00 RUB`.

**Решения**
- Оба эндпоинта отдают `currency` без изменений в `app.ts`: они возвращают товары из store как есть, а валюта теперь лежит в самих товарах.
- Формат с кодом валюты сделан через `Intl.NumberFormat` с `currencyDisplay: 'code'`. Старый `formatMoney` остался, поэтому формат цены в заказах не изменился.