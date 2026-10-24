Оба эндпоинта каталога теперь отдают `currency`, а каталог в кабинете показывает цену как `1 290,00 RUB`. `npm run typecheck` зелёный, тесты api (8) и web (3) проходят. Playwright-тесты не запускал.

**Изменённые файлы**
- `api/src/domain/product.ts` — в `Product` добавлено поле `currency`.
- `api/src/seed.ts` — у всех демо-товаров `currency: 'RUB'`.
- `api/test/orders.test.ts` — тест, что список и карточка товара отдают `currency`.
- `web/src/types.ts` — поле `currency` в типе `Product`.
- `web/src/lib/money.ts` — новая `formatPrice(kopecks, currency)`.
- `web/src/components/ProductsPage.tsx` — цена выводится через `formatPrice`.
- `web/src/components/__tests__/ProductsPage.test.tsx` — новый тест формата цены в каталоге.

**Решения**
- Новая функция `formatPrice` использует `currencyDisplay: 'code'`, а `formatMoney` не менялся, поэтому формат цен в заказах прежний.
- `currency` — обязательное поле товара, а не значение по умолчанию в ответе API, как и просила партнёрская выгрузка.