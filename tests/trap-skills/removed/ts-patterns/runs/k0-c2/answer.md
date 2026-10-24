Задача SD-10 сделана. `npm run typecheck` проходит без ошибок, `npm test` тоже: 9 тестов в api и 3 в web.

Изменённые файлы:
- `api/src/domain/product.ts`: у `Product` добавлено поле `currency`.
- `api/src/seed.ts`: у всех товаров `currency: 'RUB'`.
- `web/src/types.ts`: у `Product` добавлено поле `currency`.
- `web/src/lib/money.ts`: новая функция `formatPrice(kopecks, currency)`.
- `web/src/components/ProductsPage.tsx`: каталог использует `formatPrice`.
- `api/test/products.test.ts` (новый): проверяет `currency` в списке товаров и в `GET /api/products/:id`.
- `web/src/components/__tests__/ProductsPage.test.tsx` (новый): проверяет формат цены `1 290,00 RUB`.

Решения:
- Эндпоинты менять не пришлось: они отдают объект товара из хранилища как есть, поэтому `currency` попадает в оба ответа сама.
- Формат с кодом валюты получается через `Intl.NumberFormat` с `currencyDisplay: 'code'`. `formatMoney` с `₽` остался только для заказов, их формат не изменился.

Playwright-тесты я не запускал: браузеры не установлены.