Оба эндпоинта теперь отдают `currency: "RUB"` у каждого товара, а каталог в кабинете показывает цены вида `1 290,00 RUB`. `npm run typecheck` проходит, тесты зелёные: api 8 из 8, web 3 из 3. Playwright я не запускал, браузеров нет.

Изменённые файлы:
- `api/src/domain/product.ts`
- `api/src/seed.ts`
- `api/test/orders.test.ts`: тест на `currency` в списке и в `/api/products/:id`.
- `web/src/types.ts`
- `web/src/lib/money.ts`
- `web/src/components/ProductsPage.tsx`
- `web/src/components/__tests__/ProductsPage.test.tsx` (новый)

Решения:
- Формат цены в каталоге делает новая `formatPrice(kopecks, currency)` с `currencyDisplay: 'code'`. `formatMoney` остался только для заказов, их формат не менялся.
- Поле `currency` добавлено в `Product` в api и в web отдельно: типы там уже дублируются (`web/src/types.ts` рядом с `api/src/domain/product.ts`). Общие типы я не вводил, это вне задачи.
- Остаток: в `api/src/domain/product.ts` тип валюты — `string`, без проверки на код ISO 4217. Для одной валюты `RUB` в seed этого достаточно. Если появятся другие, имеет смысл сузить тип.