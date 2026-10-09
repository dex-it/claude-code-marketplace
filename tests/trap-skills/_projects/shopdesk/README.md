# Мини-проект Shopdesk: вход наборов группы 2.3

Кабинет покупателя интернет-магазина: монорепо npm workspaces `api` (Express 4 + TypeScript + zod),
`web` (React 19 + Vite 7), `e2e` (Playwright). Вход наборов ts-patterns, ts-nodejs-api, ts-vitest-jest,
react и playwright (группа 2.3, #298). Файл - ключ для судьи, исполнителю не подаётся: `setup.sh` не
копирует в каталог прогона ни его, ни `mines/`.

## Устройство

```
setup.sh <dest> [ветка]   git-репозиторий в <dest>: stages/* - коммиты main, branches/<имя>/* - ветка feature/<имя> от main;
                          в конце npm ci --offline --ignore-scripts (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1)
stages/                   1 api + корень монорепо + package-lock.json; 2 web; 3 e2e (смоук); 4 клиент склада, резерв
                          с повторами (модуль SD-13), docs/payments-api.md; 5 задачи docs/tasks/SD-10..SD-15
branches/admin-refunds    feature/admin-refunds, 3 коммита, задача SD-16 в ветке - кейс R1
branches/order-dashboard  feature/order-dashboard, 3 коммита, задача SD-17 в ветке - кейс R2
mines/K1..K3              скрытые тесты судьи (run.sh <repo>), эталоны reference-ok.patch / reference-trap.patch к main
```

Каждая стадия - каталог с файлами коммита и служебными `COMMIT` (сообщение), `DATE` (дата автора и
коммиттера), опционально `DELETE` (пути к удалению). Автор коммитов - `Shopdesk Team <dev@shopdesk.example>`,
даты - 01.09-29.09.2026 по возрастанию.

Версии (точные, без `^`/`~`, из `package-lock.json`): express 4.22.3, @types/express 4.17.25, zod 4.6.5,
typescript 5.9.3, vitest 4.1.7, vite 7.3.6, @vitejs/plugin-react 5.2.0 (последняя с vite 7 в peer; 6.x - только
vite 8), supertest 7.3.1, @types/supertest 7.2.1, @types/node 22.20.4, react / react-dom 19.2.7,
@types/react 19.2.17, @types/react-dom 19.2.3, jsdom 29.1.1, @testing-library/react 16.3.2,
@testing-library/dom 10.4.2 (peer RTL, ставится npm сам), @testing-library/user-event 14.6.1,
@testing-library/jest-dom 6.9.1, @playwright/test 1.63.0 (браузеров нет; `npx playwright test --list` работает).
Node 24 (CI), локально проверено на Node 24.20.0 / npm 11.19.0.

Почему Express 4: на 5.x отклонённый промис обработчика сам уходит в `next(err)`, ловушка N1 невозможна.

Сеть была только на подготовке: `npm install --prefer-offline --ignore-scripts`. Докачано в кэш npm 25
пакетов (разница ключей `~/.npm/_cacache/index-v5` до и после установки) - список в
`~/.cache/work/group-2-3/scratch/npm-downloaded.txt`: @babel/generator, @babel/helper-plugin-utils,
@babel/parser, @babel/plugin-transform-react-jsx-self, @babel/plugin-transform-react-jsx-source,
@babel/traverse, @babel/types, @playwright/test 1.63.0, @rolldown/pluginutils, @rollup/rollup-darwin-arm64,
@testing-library/dom 10.4.2, @types/babel__* (4), @vitejs/plugin-react 5.2.0, baseline-browser-mapping,
browserslist, caniuse-lite, electron-to-chromium, node-releases, playwright 1.63.0, react-refresh 0.18.0,
rollup 4.64.0, update-browserslist-db. Прогоны идут без сети: `setup.sh` ставит зависимости `--offline`.
Оговорка: rollup тянет платформенный бинарь, в кэше он только для darwin-arm64.

Проверено на развёрнутом репозитории: `setup.sh` - код 0; `npm run typecheck` и `npm test` зелёные на main
(api 7 тестов, web 2), feature/admin-refunds (api 10, web 2) и feature/order-dashboard (api 10, web 6);
`npx playwright test --list` в e2e - 1 тест; `vite build` и `tsc -p tsconfig.build.json` проходят.

## Кейсы

| Кейс | Вход | Потребитель |
|---|---|---|
| K0 | main, `docs/tasks/SD-10-product-currency.md` - поле `currency` у товаров, формат цены в каталоге | ts-patterns + ts-nodejs-api + react (контроль: ловушек в задаче нет) |
| K1 | main, `SD-11-order-payment.md` - `POST /api/orders/:id/pay`, HTTP-шлюз по `docs/payments-api.md` | ts-patterns + ts-nodejs-api; мины `mines/K1` |
| K2 | main, `SD-12-order-search.md` - поиск по мере ввода на «Мои заказы» | ts-patterns + react; мины `mines/K2` |
| K3 | main, `SD-13-reservation-tests.md` - unit-тесты `api/src/services/reservation.ts` | ts-vitest-jest + ts-patterns; мины `mines/K3` |
| K4 | main, `SD-14-e2e-orders.md` - три e2e-сценария | playwright (судится по коду) |
| K5 | main, `SD-15-e2e-ci.md` - e2e в GitHub Actions с материалами разбора | playwright (судится по коду) |
| R1 | `feature/admin-refunds` (SD-16), ревью ветки против main | ts-patterns + ts-nodejs-api |
| R2 | `feature/order-dashboard` (SD-17), ревью ветки против main | ts-patterns + react |

Что на main сделано нарочно (чтобы сосед не подсказывал): все обработчики синхронные, без async/await,
try/catch и обёрток; `express.json()` без limit; `errorHandler` с 4 параметрами; клиент склада не читает
JSON (id резерва из `Location`), поэтому в api нет образца разбора ответа; `res.json()` в api (типы undici)
возвращает `unknown`, в web (lib.dom) - `any`; смоук e2e без локаторов по ролям; в `playwright.config.ts` нет
`trace`, `retries`, `reporter`; CI без e2e-джобы; `vitest.config.ts` api без clearMocks/restoreMocks/mockReset;
`OrdersPage` грузит список в useEffect при монтировании без флага отмены и без AbortController (образца
защиты от устаревшего ответа у K2 нет; правка оператора до прогонов, эталоны K2 пересняты); в SD-15 «трейсы»
описаны как «пошаговая запись упавших тестов». SD-14 правлен оператором до прогонов: снят критерий «тесты не
зависят друг от друга и от порядка запуска» (называл предмет W6, W8), «отмена заказа #1001» -> «отмена нового
заказа» (иначе повтор теста на общем сервере невозможен по построению задачи).

## Ключ

K - дефект под ловушку скилла (единица - в последнем столбце), O - дефект вне скиллов, B - приманка
(находка по ней ложная). Строки - по файлам в голове ветки.

Засчитывание ревью (R1, R2), записано до первого прогона: находка стоит в месте ключа (файл и строка или
соседняя строка того же обработчика) и её исход снимает дефект или называет его последствие; слово ловушки не
требуется, severity не судится. Одна находка, называющая два дефекта ключа, засчитывается обоим, если названы
оба последствия. B - провал, если находка по приманке требует правки с severity blocker или major. Единица
снимается при 2/2 контроля.

### R1: feature/admin-refunds

Коммиты: `SD-16: модель возврата, хранилище и клиент провайдера возвратов` (23.09), `SD-16: эндпоинты возвратов
в админке, аудит действий, письмо клиенту` (25.09), `Манифест деплоя api в кластер` (26.09).

| id | место (файл:строка в ветке) | дефект и последствие | ловушка-единица |
|---|---|---|---|
| K-N1 | `api/src/routes/admin-refunds.ts:32,36,43,88` (throw в 38, 45, 48, 51, 56, 90; отказ провайдера в 66) | async-обработчики без try/catch/next и без обёртки: на Express 4 отклонённый промис не доходит ни до какого обработчика ошибок - запрос висит до таймаута клиента, в процессе unhandled rejection (404 возврата, 409/422, ZodError, отказ провайдера) | ts-nodejs-api N1 |
| K-N3 | `api/src/routes/admin-refunds.ts:95-99` | «обработчик ошибок» роутера с тремя параметрами `(err, req, res)`: Express считает его обычным middleware `(req, res, next)`, ошибки он не получает; на несовпавших путях `/api/admin/*` вызывается с req вместо err и падает TypeError (`res.status` - это `next`) | ts-nodejs-api N3 |
| K-N4 | `api/src/errors.ts:24-26` | общий `errorHandler` отдаёт клиенту `details: err.stack` для любой не-HttpError ошибки («для разбора инцидентов») - утечка путей, версий, внутренностей | ts-nodejs-api N4 |
| K-N5 | `api/src/routes/admin-refunds.ts:91` | `refund.status = req.body.status` без схемы: любой статус, любой тип (`{"status": {"x":1}}`, `"hacked"`), соседи валидируют zod | ts-nodejs-api N5+N6 |
| K-N7 | `api/src/validation.ts:39`, `:43-48`; `api/src/routes/admin-refunds.ts:45`, `:62`, `:68`, `:75` | схема делает `amountKopecks` опциональной, рядом ручной `interface CreateRefund` с обязательным `number` и `parse(...) as CreateRefund`: при пропуске суммы `orderBalanceKopecks = total - undefined = NaN` (в JSON `null`), в возврат и провайдеру уходит `undefined` вместо суммы; типы врут, tsc молчит | ts-nodejs-api N7 (+ ts-patterns P2 as) |
| K-N8 | `api/src/app.ts:92-94` | админ-роутер подключён после `app.use(errorHandler)`: синхронные ошибки админки (401/403 из requireAdmin) уходят в finalhandler Express - HTML-страница вместо `{ error }` JSON, вне production со стеком | ts-nodejs-api N8 |
| K-N10 | `api/src/routes/admin-refunds.ts:88` | `requireAdmin` навешан на каждый маршрут отдельно (32, 36, 43), на `PATCH /refunds/:id` забыт; `requireUser` на роутере нет - менять статус возврата может кто угодно без токена | ts-nodejs-api N10 |
| K-N11 | `api/src/server.ts:34-38` (и `:30` - результат `app.listen` больше не сохраняется) | SIGTERM: `audit.close(); process.exit(0)` без `server.close()` - запросы в полёте обрываются при каждом деплое/скейле | ts-nodejs-api N11 |
| K-N12 | `api/src/clients/refunds-provider.ts:1`, `:17` | `REFUNDS_URL` читается без проверки, при старте не валидируется; без переменной `new URL('/v1/refunds', undefined)` бросает TypeError только при первом возврате (и, с K-N1, вешает запрос) | ts-nodejs-api N12 |
| K-N13 | `deploy/k8s.yaml:41-51` | readinessProbe и livenessProbe `httpGet /healthz`, маршрута в приложении нет: 404 - под не становится ready, liveness перезапускает его по кругу | ts-nodejs-api N13 |
| K-P5 | `api/src/routes/admin-refunds.ts:46-47` | `deps.store.orders.get(body.orderId)!` и сразу `order.status`: несуществующий заказ - TypeError вместо 404 (с K-N1 - зависший запрос) | ts-patterns P5 |
| K-P8 | `api/src/routes/admin-refunds.ts:79-83` | `try { notifyCustomer(completed) } catch` без `await`: async-функция возвращает промис, catch не сработает никогда, отказ сервиса писем - unhandled rejection (на Node 15+ по умолчанию падение процесса) | ts-patterns P8 |
| K-P11 | `api/src/routes/admin-refunds.ts:55` | защита от дубля `r.items === body.items` сравнивает массивы по ссылке - всегда false, повторный возврат уходит провайдеру второй раз (критерий SD-16 нарушен) | ts-patterns P11 |
| K-N14 | `api/src/audit.ts:14` (вызов на каждый запрос - `admin-refunds.ts:27-30`) | `fs.appendFileSync` на каждый запрос блокирует event loop (справочно: единица снята без прогона, дом - performance-review) | ts-nodejs-api N14 (справочно) |
| O1 | `api/src/clients/refunds-provider.ts:22-23` | нет проверки `res.ok`: на 4xx/5xx тело `{ "error": ... }`, `refund_id` - undefined, возврат помечается `completed` с `providerRefundId: undefined` - деньги не вернулись, в системе «выполнено» | вне скиллов |
| O2 | `api/src/routes/admin-refunds.ts:50-52` (при `:54`) | сумма сравнивается только с суммой заказа, уже выполненные возвраты по заказу не учитываются - сумма возвратов может превысить сумму заказа (критерий SD-16) | вне скиллов |
| B1 | `api/src/domain/refund.ts:1` | строковый `enum RefundStatus` - как `OrderStatus` на main, конвенция проекта | приманка (ts-patterns P3, снят без прогона) |
| B2 | `api/src/routes/admin-refunds.ts:25` | `router.use(express.json())` без limit: лимит по умолчанию 100kb, повторный парсер безвреден | приманка (ts-nodejs-api N9, снят) |
| B3 | `api/src/routes/admin-refunds.ts:37-39` | два последовательных await, второй зависит от первого (сначала возврат, потом возвраты по его заказу) - распараллелить нельзя | приманка (ts-patterns P6, снят) |

Заметки для судьи: тест ветки `api/test/admin-refunds.test.ts` зелёный именно благодаря K-P11 (два возврата
по одному заказу с одинаковыми позициями) и ответ 403 в нём приходит из finalhandler (K-N8), у HttpError есть
`status`. Находки «нет тестов на ошибки» - верные, но не засев.

### R2: feature/order-dashboard

Коммиты: `SD-17: API заказов для админки, скидка и адрес доставки у заказа` (24.09, api корректный:
`router.use(requireUser, requireAdmin)`, zod на адресе), `SD-17: дашборд заказов - ...` (28.09), `SD-17: выбор
периода на дашборде с быстрыми пресетами` (29.09, в теле коммита: «strict в web/tsconfig.json выключен временно,
чтобы собрать календарь»).

| id | место (файл:строка в ветке) | дефект и последствие | ловушка-единица |
|---|---|---|---|
| K-R1 | `web/src/components/dashboard/OrderDashboard.tsx:47-49` | `setTotals({ ...totals, count })` в эффекте с `totals` в deps: каждый вызов - новый объект, эффект перезапускается бесконечно (Maximum update depth) | react R1 |
| K-R2 | `OrderDashboard.tsx:22`, `:34-36` | `filters` - новый объект на каждый рендер и в deps эффекта загрузки; `load` делает setState - бесконечные запросы к `/api/admin/orders` | react R2+R14 |
| K-R3 + K-R4 | `OrderDashboard.tsx:38-40` | автообновление `setInterval(() => load(filters), 30000)` с `[]`: интервал без clearInterval (утечка, после размонтирования грузит и ставит state; в StrictMode два интервала) и замкнутые фильтры первого рендера - автообновление сбрасывает выбранные фильтры | react R4, R3 |
| K-R5 | `web/src/components/dashboard/OrderDetails.tsx:10-14` | загрузка деталей по `selectedId` без отмены и без игнора устаревшего ответа: быстрый выбор двух заказов - на панели может остаться первый; ошибка не обрабатывается (`r.json()` на 404) | react R5 |
| K-R7 | `web/src/components/dashboard/OrderRow.tsx:14` + `OrderDashboard.tsx:120` | `memo(OrderRow)`, а `onSelect={() => setSelectedId(o.id)}` - новая функция на каждый рендер, memo не срабатывает ни разу | react R7 |
| K-R10 | `OrderDashboard.tsx:64` (+ `:43` тикер `now` раз в секунду), потребитель `OrderRow.tsx:15` | `DashboardContext.Provider value={{ orders, filters, now }}` - новый объект каждую секунду (часы в шапке): все строки таблицы перерисовываются раз в секунду, хотя им нужен только `filters` | react R10 |
| K-R12 | `web/src/components/dashboard/AddressForm.tsx:59` (поля `:62`, `:67` с defaultValue) | получатели с `key={i}` и неуправляемыми полями: после «Удалить» у первого получателя в строках остаются введённые значения удалённого, отправляются другие данные, чем на экране | react R12 |
| K-R13 | `OrderRow.tsx:24` | `{order.discountKopecks && <DiscountBadge/>}` - при скидке 0 (у большинства заказов) в ячейке рисуется «0» | react R13 |
| K-R16 | `AddressForm.tsx:22` (используется `:55-56`) | `function Field` объявлен внутри `AddressForm`: на каждый рендер новый тип компонента, поле перемонтируется - после каждого символа фокус теряется | react R16 |
| K-P12 | `web/src/lib/dashboard.ts:30-31` + `OrderDashboard.tsx:105` | `sortByDate` делает `list.sort` на месте и возвращает тот же массив; `setOrders(sortByDate(orders))` мутирует state и отдаёт ту же ссылку - React не перерисовывает, кнопка «Сортировать» не работает | ts-patterns P12 |
| K-P13 | `web/tsconfig.json:10` (неявный any - `web/src/components/dashboard/PeriodPicker.tsx:13,17,21,28`) | `"strict": false` для всего web «временно»: выключены strictNullChecks и noImplicitAny во всём пакете; параметры `pad`, `toDateInput`, `daysAgo`, `applyPreset` - неявный any (с `--strict` 5 ошибок TS7006) | ts-patterns P13 |
| O3 | `web/src/lib/dashboard.ts:25` | период «по» включительно (SD-17), а фильтр `order.createdAt < filters.to`, где `to` - дата без времени (`2026-09-10` < `2026-09-10T...`): заказы последнего дня выпадают; тест ветки этот случай не покрывает | вне скиллов |
| O4 | `OrderDashboard.tsx:98` | выручка `stats.revenueKopecks.toLocaleString('ru-RU') ₽` - копейки показаны как рубли, в 100 раз больше | вне скиллов |
| B4 | `OrderDashboard.tsx:51` | `useMemo(() => summarize(orders), [orders])` - агрегация по всему списку заказов, мемоизация оправдана | приманка (react R6) |
| B5 | `OrderDashboard.tsx:96` | `style={{ ... }}` на обычном `<div>` - не memo-компонент и не deps, новый объект безвреден | приманка (react R2/R14) |
| B6 | `OrderDashboard.tsx:53-55` (кнопка `:100`) | `useCallback` у обработчика обычной `<button>` - лишний, но безвредный | приманка (react R7) |

Заметки: K-R1 и K-R2 вместе делают дашборд нерабочим в браузере - находка «бесконечный цикл» по любой из них
верна, но засчитывается по своей строке. Тесты ветки - только на чистые функции `lib/dashboard.ts`, компонент
дашборда не рендерится (иначе тесты висли бы).

### Ключ поручений K0-K5

Записан оператором до первого прогона. Засчитывается исход в выходе (код, тест, конфиг, исполнение мин), а
не слова. «-» в прогоне - ситуация в выходе не возникла (единица этим прогоном не судится). Единица снимается
при 2/2 контроля по этому ключу.

#### K0 - ничего не менять (SD-10)

Верное решение трогает только поле `currency` (тип, роуты товаров, seed или маппинг), формат цены каталога
и тесты. Предмет ловушек не задет.

| id | Проверка | Провал |
|---|---|---|
| K0-a | Оба эндпоинта отдают `currency: "RUB"`, каталог - `1 290,00 RUB`, заказы - прежний формат; `npm run typecheck`, `npm test` зелёные | требование не выполнено или красно |
| K0-b | Не тронуты по предмету ловушек: `express.json()`, `errorHandler`, синхронные обработчики (обёртки, try/catch), `enum OrderStatus`, `tsconfig*` (`strict`, `skipLibCheck`), `!` в `main.tsx`, эффекты `OrdersPage`, конфиг vitest | любая такая правка вне задачи - вред; судится по `diff.patch` |

Мелкие правки вне предмета ловушек (переименование, форматирование) записываются, провалом не считаются.

#### K1 - оплата заказа (SD-11)

| id | Единица | Проверка | Допустимо | Провал |
|---|---|---|---|---|
| K1-N1 | ts-nodejs-api: отказ async-обработчика | мина M3 PASS | try/catch + `next(err)`, обёртка над обработчиком, явный ответ в catch, `express-async-errors` (если бы был в зависимостях) | M3 FAIL (ответа нет за 2 с или unhandled rejection) |
| K1-P7 | ts-patterns: отказ одного из независимых промисов | мина M4 PASS по статусу: отказ письма или аналитики не превращает оплату в ошибку | `Promise.allSettled`, отдельный catch на каждый эффект, отправка в фоне с `.catch` и логом, очередь | M4 FAIL с ответом >= 500 или без ответа |
| K1-P8 | ts-patterns: промис без await и обработки отказа | мина M4 PASS по unhandled | `.catch`/`allSettled` у каждого фонового промиса | M4 FAIL с `unhandled` |
| K1-P1 | ts-patterns: внешние данные без проверки (`any`, `as`, `typeof null`) | HTTP-реализация шлюза проверяет тело ответа во время исполнения до использования | zod `parse`/`safeParse`, type guard с проверкой `status` и нужного поля (`transaction_id` / `decline_reason`), включая проверку на `null` | `as`, `any`, присваивание `unknown` через приведение, guard через `typeof x === 'object'` без проверки `null` |
| K1-N12 | ts-nodejs-api: env не проверяется при старте | `PAYMENT_URL` и `PAYMENT_API_KEY` проверены при старте: без них сервис не стартует с внятной ошибкой | проверка в `config.ts`/`server.ts` до `listen`, схема zod на env | чтение в момент запроса, `!`, `?? ''`, дефолт-адрес |
| K1-O1 | вне скиллов | HTTP-шлюз не считает ответ 4xx/5xx одобрением: `res.ok` или статус проверен, ошибка шлюза - не `approved` | - | ответ с `{"error":...}` уходит в разбор как результат списания |
| K1-O2 | вне скиллов | мины M1, M2, M5, M6 PASS; тесты на 4 сценария задачи написаны и зелёные | - | любая мина FAIL или тестов нет |

#### K2 - поиск заказов (SD-12)

| id | Единица | Проверка | Допустимо | Провал |
|---|---|---|---|---|
| K2-R15 | react: запрос на каждое нажатие | мина M1 PASS | задержка через setTimeout в эффекте, свой хук, throttle | M1 FAIL; `useDeferredValue` сам запросов не сокращает (react.dev, useDeferredValue) |
| K2-R5 | react: устаревший ответ перезаписывает свежий | мина M2 PASS | AbortController, флаг игнора в cleanup, сверка номера запроса | M2 FAIL |
| K2-R4 | react: эффект без очистки | мина M3 PASS | cleanup снимает таймер и/или отменяет запрос | M3 FAIL |
| K2-O1 | вне скиллов | мина M4 PASS; пустой запрос - полный список; тест на компонент есть; typecheck и test зелёные | - | иначе |

Список заказов с `key={order.id}` уже есть на main: R12 в K2 средой задан и не судится.

#### K3 - тесты резервирования (SD-13)

Судится по `mines/K3/run.sh` и коду тестов исполнителя.

| id | Единица | Проверка | Допустимо | Провал |
|---|---|---|---|---|
| K3-V1 | ts-vitest-jest: фабрика `vi.mock` и переменная модуля | итоговые тесты исполняются (TESTS PASS); ход «упал на hoisting и исправил по сообщению vitest» записывается наблюдением | `vi.hoisted`, `importOriginal`, автомок + `vi.mocked`, фабрика без внешних переменных | итоговый файл падает с ошибкой hoisting |
| K3-V2 | ts-vitest-jest: состояние моков между тестами | SHUFFLE seed 1-5 PASS | `clearAllMocks`/`resetAllMocks` в `beforeEach`, конфиг `clearMocks`/`mockReset`, только `*Once`-реализации | любой seed FAIL из-за состояния мока |
| K3-V4 | ts-vitest-jest: фейковые таймеры не возвращены | если включены `useFakeTimers` - возвращены (`afterEach(useRealTimers)` или в том же тесте в `finally`) | конфиг `fakeTimers` с восстановлением; таймеры не подменялись - «-» | включены и не возвращены |
| K3-V5 | ts-vitest-jest: реальное ожидание | паузы повторов 1 с и 2 с не ждутся в реальном времени | fake timers (`advanceTimersByTimeAsync`, `runAllTimersAsync`), подмена `setTimeout` шпионом | тест ждёт реальные паузы (TIME тестов >= 1 с, поднятый timeout) |
| K3-V6 | ts-vitest-jest: `resolves`/`rejects` без await | каждый `expect(...).resolves/.rejects` выжидается или возвращается | - | невыжданный (vitest 4.1.7 сам помечает такой тест failed - проба оператора 06.10.2026) |
| K3-V7 | ts-vitest-jest: проверка ошибки в catch без гарантии | мутант MU1 KILLED | `await expect(p).rejects...`, `expect.assertions(n)`, `expect.fail` после вызова | MU1 SURVIVED |
| K3-V8 | ts-vitest-jest: проверка до завершения async | утверждения о результате и числе вызовов стоят после завершения промиса | - | утверждение до await действия (по коду) |
| K3-O1 | вне скиллов (дизайн тестов, дом - `test-design`, #299) | MU2, MU3, MU4 KILLED; к настоящему складу обращений нет | - | справочно, охват |

#### K4 - e2e-тесты (SD-14)

Браузеров нет: судится по коду и конфигу; `npx tsc -p e2e` (или `npm run typecheck`) и
`npx playwright test --list` должны проходить. У alice два заказа в статусе new (#1001, #1002) - две кнопки
«Отменить» на странице.

| id | Единица | Проверка | Допустимо | Провал |
|---|---|---|---|---|
| K4-W1 | playwright: CSS-локаторы | элементы приложения находятся по роли, подписи, тексту или test id | `getByRole`, `getByLabel`, `getByText`, `getByTestId` (с добавлением `data-testid` в web) | селекторы по классу, id, XPath |
| K4-W2 | playwright: локатор с несколькими совпадениями | отмена и проверка «кнопки нет» ограничены строкой выбранного заказа | `getByRole('listitem').filter({ hasText })`, `locator(...).filter`, вложенный локатор от строки | неограниченный `getByRole('button', { name: 'Отменить' })` (strict violation) или `.first()`/`.nth()` без привязки к заказу |
| K4-W3 | playwright: пауза, разовое значение, действие без проверки эффекта | нет `waitForTimeout`; состояние DOM - web-first assertions; после «Отменить» следующий шаг идёт за ожиданием эффекта | `await expect(locator).toHaveText/toBeVisible/toHaveCount` | `waitForTimeout`, `expect(await locator.textContent()).toBe(...)`, `isVisible()` в `expect(...).toBe(true)` |
| K4-W6 | playwright: общий context | каждый тест на своей фикстуре `page` | - | `browser.newContext/newPage` в `beforeAll` и переиспользование |
| K4-W7 | playwright: вход через UI в каждом тесте | тесты 2 и 3 не проходят форму входа сами | setup-проект + `storageState`; вход через `request` и токен в localStorage (`addInitScript`, `storageState`); UI-вход - только в тесте 1, где он предмет проверки | форма входа в `beforeEach` или в каждом тесте |
| K4-W8 | playwright: данные на общем сервере | отмена не портит общий seed: повтор теста (retry, повторный запуск при `reuseExistingServer`) и другие тесты не зависят от того, отменён ли заказ | заказ под отмену создаётся тестом через API; сброс состояния; тест 1 не утверждает статус заказа, который отменяет тест 2, и повтор теста 2 проходит | отменяется заказ из seed (#1001/#1002), и повтор теста 2 или тест 1 при другом порядке падают |
| K4-W9 | playwright: `page.route` без await | перехват ошибки списка зарегистрирован с `await` до навигации или запроса | `await page.route(...)` до `goto`/перезагрузки, в `beforeEach` с await | без await или после `goto` |
| K4-O1 | вне скиллов | три сценария задачи есть; tsc зелёный; `--list` перечисляет тесты | - | иначе |

#### K5 - e2e в CI (SD-15)

| id | Единица | Проверка | Допустимо | Провал |
|---|---|---|---|---|
| K5-W14 | playwright: браузеры без системных зависимостей | браузеры в CI ставятся с зависимостями ОС | `npx playwright install --with-deps [браузер]`, отдельный `install-deps`, контейнер `mcr.microsoft.com/playwright` | `npx playwright install` без зависимостей ОС |
| K5-W11 | playwright: трейс на каждый прогон | в CI трейс не пишется на каждый тест | `retain-on-failure`, `retain-on-first-failure`, `on-first-retry` при `retries > 0` в CI | `trace: 'on'` в CI |
| K5-O1 | вне скиллов | для упавшего теста в CI трейс реально есть: `on-first-retry` только вместе с `retries > 0` | - | `on-first-retry` при `retries: 0` - трейса нет |
| K5-O2 | вне скиллов | триггеры PR и push в main; падение e2e красит сборку; отчёт и `test-results` выгружаются при падении (`if: failure()`/`always()`) | - | иначе |

### Носитель K1-P1 (смена 2, до прогонов носителя)

K1-P1 судится по колонке «Провал» буквально и одинаково во всех прогонах K1: тело ответа шлюза, приведённое
`as` к типу (в том числе к форме со всеми необязательными полями), - провал, даже если поля затем проверены.
Ключ не меняется, это чтение его колонки (решение оркестратора, 06.10.2026). Возвращённое название
`ts-patterns` P1 ложится в ось агента-потребителя `ts-fullstack-assistant` и подаётся раннеру файлом-носителем
вместо агента: `d` - строки Generate, Validate и Boundaries агента из ветки без названия, `n` - те же строки с
названием в строке про `any`. Набор: K1 d x2, K1 n x2; с `n` ещё K0 x2 и K2 x2 (кейсы пишущего: «ничего не
менять» и вред вне предмета). Скиллы в `d`, `n` - итоговые редакции `ts-nodejs-api`, `react`.

## Мины

Судья копирует `mines/` к себе и запускает `mines/<K>/run.sh <каталог прогона>` после прогона. Скрипт
временно кладёт тесты в репозиторий прогона (`api/test/__mines__/`, `web/src/__mines__/`) и убирает их по
выходу; модуль K3 восстанавливается из копии. Каждая мина - отдельный вызов vitest со своим конфигом (конфиг
исполнителя не влияет). Эталоны: `reference-ok.patch` и `reference-trap.patch` - патчи к main
(`git apply` в развёрнутом репозитории).

### K1 (SD-11, оплата)

vitest + supertest против `createApp` из `api/src/app.ts`: store из seed, фейковые payments/notifier/analytics
(обычные функции, не `vi.fn`: шпион vitest подписывается на возвращённый промис и гасит unhandled rejection),
слушатель `unhandledRejection`, ответ ждётся не дольше 2 с.

| Мина | Что доказывает |
|---|---|
| M1 | одобрено - 200, `status: paid`, шлюз вызван раз с суммой заказа и RUB |
| M2 | отклонено - 402 `payment_declined` с причиной, статус new, письма нет |
| M3 | `charge` отклоняет `Error('ECONNRESET')` - ответ >= 500 JSON за 2 с, статус new, без unhandled rejection (N1) |
| M4 | `notifier.orderPaid` и `analytics.track` отклоняют - всё равно 200/paid, без unhandled rejection (P7, P8, N1) |
| M5 | чужой заказ - 404, шлюз не вызывается |
| M6 | оплаченный заказ - 409, шлюз не вызывается |

Эталон ok: try/catch + `next(err)`, сбой шлюза -> 502, побочные эффекты через `Promise.allSettled` после ответа,
HTTP-шлюз с zod-разбором ответа, проверкой `res.ok` и таймаутом, обязательные `PAYMENT_URL`/`PAYMENT_API_KEY`.
Эталон trap: async-обработчик без try/catch (ответы 404/409/402 через `res.status().json()`), `await` писем и
аналитики подряд, шлюз с `as any` без `res.ok`, `process.env.PAYMENT_URL!`.

```
$ bash mines/K1/run.sh <ok>        $ bash mines/K1/run.sh <trap>
M1 PASS                            M1 PASS
M2 PASS                            M2 PASS
M3 PASS                            M3 FAIL
M4 PASS                                Error: no response within 2 s: Timeout of 2000ms exceeded
M5 PASS                            M4 FAIL
M6 PASS                                Error: no response within 2 s: Timeout of 2000ms exceeded
                                   M5 PASS
                                   M6 PASS
```

Контроль чувствительности M4: вариант trap с письмом и аналитикой без `await` и без catch (ответ уходит) - M4
FAIL по `unhandled`: `[Error: notifier is down, Error: analytics is down]`. На чистом main (эндпоинта нет):
M1-M4, M6 FAIL (404), M5 PASS.

### K2 (SD-12, поиск)

RTL против `OrdersPage` (токен в localStorage), `vi.stubGlobal('fetch')`: запрос без `q` отвечает сразу полным
списком, запросы с `q` - сразу (M1, M4) или по команде теста (M2, M3); сигнал отмены уважается, как у
настоящего fetch. Поле ищется по подписи «Поиск заказов» (запасные варианты - placeholder, searchbox).

| Мина | Что доказывает |
|---|---|
| M1 | 4 символа подряд (user-event, без пауз), ожидание 1.5 с - поисковых запросов больше 0 и меньше 4 (задержка ввода, R15) |
| M2 | «a», пауза 2.5 с, «ab», пауза 2.5 с; ответ на «ab» первым, затем на «a» - на экране результаты «ab» (гонка, R5) |
| M3 | ввод и размонтирование до ответа - после unmount новых запросов нет, console.error пуст (cleanup, R4) |
| M4 | пустой результат - «Ничего не найдено» |

Эталон ok: задержка 300 мс через setTimeout + AbortController в одном эффекте, cleanup снимает оба. Эталон trap:
`useEffect(() => { getOrders(query).then(setOrders, ...) }, [query])`.

```
$ bash mines/K2/run.sh <ok>        $ bash mines/K2/run.sh <trap>
M1 PASS                            M1 FAIL
M2 PASS                                AssertionError: запросы: ["к","кр","кру","круж"]: expected 4 to be less than 4
M3 PASS                            M2 FAIL
M4 PASS                                AssertionError: expected null not to be null
                                   M3 PASS
                                   M4 PASS
```

Контроль чувствительности M3: ok без `clearTimeout` в cleanup - M3 FAIL «запросы после unmount: ["x"]».
Наивный trap без задержки M3 проходит: запрос уходит до unmount, а setState после unmount в React 19 молчит.

### K3 (SD-13, тесты резерва)

`run.sh` находит тесты исполнителя, импортирующие `services/reservation`, и печатает: (1) TESTS PASS|FAIL;
(2) SHUFFLE seed=1..5 (`--sequence.shuffle --sequence.seed`); (3) мутанты `mines/K3/mutants/*.patch` - KILLED,
если тесты упали, SURVIVED, если прошли, ERROR, если модуль изменён и патч не лёг; (4) TIME - время прогона.

| Мутант | Изменение | Ловит |
|---|---|---|
| MU1 | после исчерпания попыток `return { reservationId: '', attempts }` вместо throw | try/catch-тест без `expect.assertions`/`rejects` (V7) |
| MU2 | `MAX_ATTEMPTS = 1` | отсутствие теста на повтор |
| MU3 | убрана проверка `instanceof TemporaryInventoryError` - повтор любой ошибки | слабое утверждение на нетемпоральной ошибке |
| MU4 | `isHoldExpired`: `>=` вместо `>` | нет теста на границу |

Эталон ok: `vi.mock` с `importOriginal` (класс ошибки настоящий), fake timers с `advanceTimersByTimeAsync`,
`expect(promise).rejects` до продвижения таймеров, сброс мока в beforeEach, граница hold. Эталон trap: реальные
паузы 1 + 2 с, try/catch без `expect.assertions`, `instanceof Error` на нетемпоральной ошибке, моки не
сбрасываются (`toHaveBeenCalledTimes(1)` в первом тесте верен только при исходном порядке), граница hold не
проверена.

```
$ bash mines/K3/run.sh <ok>                       $ bash mines/K3/run.sh <trap>
files: test/reservation.test.ts                   files: test/reservation.test.ts
TESTS PASS (Tests  6 passed (6))                  TESTS PASS (Tests  5 passed (5))
SHUFFLE seed=1 PASS                               SHUFFLE seed=1 FAIL (Tests  1 failed | 4 passed (5))
SHUFFLE seed=2 PASS                               SHUFFLE seed=2 FAIL (Tests  1 failed | 4 passed (5))
SHUFFLE seed=3 PASS                               SHUFFLE seed=3 FAIL (Tests  1 failed | 4 passed (5))
SHUFFLE seed=4 PASS                               SHUFFLE seed=4 PASS
SHUFFLE seed=5 PASS                               SHUFFLE seed=5 PASS
MU1 KILLED  (MU1-return-after-exhaustion)         MU1 SURVIVED (MU1-return-after-exhaustion)
MU2 KILLED  (MU2-single-attempt)                  MU2 KILLED  (MU2-single-attempt)
MU3 KILLED  (MU3-retry-any-error)                 MU3 SURVIVED (MU3-retry-any-error)
MU4 KILLED  (MU4-hold-boundary)                   MU4 SURVIVED (MU4-hold-boundary)
TIME 1651 ms wall (vitest: 132ms ...)             TIME 5641 ms wall (vitest: 4.14s ...)
```

Итог мутантов: ok 4/4 KILLED; trap 1/4 KILLED (MU1, MU3, MU4 SURVIVED). Время файла тестов: ok 6 мс тестов,
trap 4.01 с (реальные паузы, V5).
