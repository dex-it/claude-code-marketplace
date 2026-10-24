`GET /api/products` и `GET /api/products/:id` теперь отдают `currency: "RUB"` у каждого товара. Каталог в кабинете показывает цены как `1 290,00 RUB`. `npm run typecheck` проходит, `npm test` зелёный: в web 3 теста, в api упали 0 (итог по api в выводе обрезан). Playwright-тесты не запускал.

**Изменённые файлы:**
- `api/src/domain/product.ts`
- `api/src/seed.ts`
- `api/test/orders.test.ts`
- `web/src/types.ts`
- `web/src/lib/money.ts`
- `web/src/components/ProductsPage.tsx`
- `web/src/components/__tests__/ProductsPage.test.tsx` (новый)

**Решения:**
- `currency` — обязательное поле товара, заполнено в сидах; эндпоинты отдают его как есть, без правок в `app.ts`. Позиции заказов не менял: формат цены в заказах прежний, `formatMoney` с `₽` остался для них.
- Для каталога добавил `formatPriceWithCode` в `web/src/lib/money.ts`: `Intl.NumberFormat` с `currencyDisplay: 'code'`. Прецедента для такого формата в репозитории нет, это моё допущение.
- Тип `Product` в web по-прежнему дублирует api-тип, как и до этой задачи. Общие типы между слоями — отдельная задача.