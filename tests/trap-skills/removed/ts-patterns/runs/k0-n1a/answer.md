Каталог теперь отдаёт `currency` у каждого товара, а кабинет показывает цены в формате `1 290,00 RUB`. `npm run typecheck` и `npm test` проходят (api: 8 тестов, web: 3). Playwright-тесты не запускал, браузеров нет.

Изменённые файлы:
- `api/src/domain/product.ts`
- `api/src/seed.ts`
- `api/test/orders.test.ts`
- `web/src/types.ts`
- `web/src/lib/money.ts`
- `web/src/components/ProductsPage.tsx`
- `web/src/components/__tests__/ProductsPage.test.tsx` (новый)

Решения:
- `currency` добавлен в модель `Product` как строка с кодом ISO 4217, а в демо-данных у всех пяти товаров стоит `'RUB'`. Оба эндпоинта возвращают товар как есть, поэтому правок в `app.ts` не понадобилось.
- Для каталога добавил отдельную функцию `formatMoneyWithCode` в `money.ts`. Старый `formatMoney` не трогал, поэтому формат цен в заказах прежний (`₽`).
- Добавил тест API на `currency` в обоих эндпоинтах и тест `ProductsPage` на новый формат цены.