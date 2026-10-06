Оба эндпоинта теперь отдают `currency: "RUB"` у каждого товара, а каталог в кабинете показывает цену в виде `1 290,00 RUB`. `npm run typecheck` и `npm test` проходят. Playwright-тесты не запускал, так как браузеры не установлены.

**Изменённые файлы**
- `api/src/domain/product.ts`: в `Product` добавлено поле `currency`.
- `api/src/seed.ts`: у всех демо-товаров `currency: 'RUB'`.
- `web/src/types.ts`: поле `currency` в `Product`.
- `web/src/lib/money.ts`: новая функция `formatPrice(kopecks, currency)`.
- `web/src/components/ProductsPage.tsx`: каталог использует `formatPrice`.
- `api/test/products.test.ts` (новый): проверяет `currency` в списке и в `GET /api/products/:id`.
- `web/src/components/__tests__/ProductsPage.test.tsx` (новый): проверяет формат цены в каталоге.

**Решения**
- Валюта хранится в самом товаре, а эндпоинты отдают его как есть. Для витрины Казахстана достаточно будет задать другой код у товара.
- `formatMoney` не менял, поэтому формат цены в заказах прежний (`₽`). Для каталога сделал отдельную `formatPrice` на `Intl.NumberFormat` с `currencyDisplay: 'code'`. В выводе `Intl` пробелы неразрывные, и тест это учитывает.