# Shopdesk

Личный кабинет покупателя небольшого интернет-магазина: вход, каталог, заказы. Монорепозиторий на npm
workspaces.

## Структура

```
api/   HTTP API на Express 4 + TypeScript (ESM). Хранилище в памяти, демо-данные - src/seed.ts
web/   кабинет покупателя на React 19 + Vite 7
e2e/   сквозные тесты на Playwright
docs/  описание внешних API и задачи команды (docs/tasks)
```

## Запуск

Нужен Node.js 22+ (в CI - 24).

```bash
npm ci
npm run build -w api && SEED_DEMO=1 npm run start -w api              # API на :3000
npm run dev -w web                                                      # кабинет на :5173, /api проксируется на :3000
```

Демо-учётки - в `api/src/seed.ts` (загружаются только при `SEED_DEMO=1`).

Переменные окружения API: `PORT` (3000), `NOTIFIER_URL`, `ANALYTICS_URL` - адреса сервиса писем и
аналитики (по умолчанию локальные заглушки), `INVENTORY_URL` - склад.

## Проверки

```bash
npm run typecheck   # tsc во всех пакетах
npm test            # unit- и API-тесты (vitest) в api и web
npx playwright test --config e2e/playwright.config.ts   # e2e, поднимает api и web сам; нужны браузеры Playwright
```

## Соглашения

- Деньги - целые копейки (`totalKopecks`, `priceKopecks`), форматирование только на клиенте (`formatMoney`).
- Ошибки API - `{ "error": { "code", "message" } }`, бросаются как `HttpError` и отдаются общим `errorHandler`.
- Тела запросов проверяются zod-схемами из `api/src/validation.ts`.
- Ветки - `feature/<кратко>`, PR в `main`, CI должен быть зелёным.
