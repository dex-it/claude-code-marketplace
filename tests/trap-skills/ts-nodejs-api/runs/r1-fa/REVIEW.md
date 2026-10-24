api/src/clients/refunds-provider.ts:1 - REFUNDS_URL читается из env на уровне модуля и не проверяется при старте (REFUNDS_API_KEY молча подменяется на ''); при отсутствии переменной сервис стартует, а первый возврат падает в new URL(..., undefined) с 500 уже после создания записи - blocker
api/src/clients/refunds-provider.ts:22 - не проверяется res.ok и статус: на 4xx/5xx провайдера (`{error}`) возвращается providerRefundId: undefined, а вызывающий код помечает возврат completed - деньги не возвращены, в системе возврат выполнен - blocker
api/src/clients/refunds-provider.ts:17 - fetch без таймаута и без Idempotency-ключа: зависший провайдер вешает запрос оператора, повтор после обрыва может отправить возврат провайдеру второй раз - major
api/src/routes/admin-refunds.ts:46 - заказ берётся через orders.get(...)! без проверки: несуществующий orderId даёт TypeError и 500 вместо 404 - major
api/src/routes/admin-refunds.ts:45 - createRefundSchema.parse бросает ZodError (500, а не 400 как в parseBody) и каст `as CreateRefund` скрывает, что amountKopecks в схеме optional - major
api/src/validation.ts:43 - CreateRefund объявляет amountKopecks: number, хотя в схеме он необязателен; при отсутствии суммы `undefined > total` ложно, create кладёт undefined, balance = NaN, а полный возврат по ТЗ не реализован - blocker
api/src/routes/admin-refunds.ts:50 - проверяется только сумма одного возврата, а не сумма всех возвратов по заказу (existing не суммируется): повторными частичными возвратами можно вернуть больше стоимости заказа (критерий приёмки нарушен) - blocker
api/src/routes/admin-refunds.ts:55 - дедупликация сравнивает массивы items по ссылке (`===`), условие всегда ложно: повторный возврат уходит провайдеру второй раз (критерий приёмки нарушен); плюс check-then-act с await до create без блокировки - гонка при параллельных запросах - blocker
api/src/routes/admin-refunds.ts:59 - возврат создаётся pending, затем вызов провайдера; при ошибке провайдера запись остаётся pending навсегда, статус failed нигде не ставится, повтор упрётся в дубликат - major
api/src/routes/admin-refunds.ts:80 - notifyCustomer вызывается без await внутри try/catch: отказ уведомления - необработанный rejected promise, процесс Node падает (или письмо тихо теряется); catch никогда не срабатывает - blocker
api/src/routes/admin-refunds.ts:15 - письмо идёт сырым fetch на /v1/notifications/refund мимо абстракции Notifier из deps (в тестах fetch замокан), без таймаута; клиент получает только orderId/amount - minor
api/src/routes/admin-refunds.ts:88 - PATCH без requireAdmin: любой, в том числе без авторизации, меняет статус возврата - blocker
api/src/routes/admin-refunds.ts:91 - статус из req.body.status не валидируется (любая строка, req.body может быть undefined → 500), нет проверки допустимых переходов (completed → pending), мутируется объект из хранилища напрямую - major
api/src/routes/admin-refunds.ts:88 - PATCH не пишет в журнал аудита с actor (только общий middleware без actor); смена статуса возврата не прослеживается по автору - major
api/src/routes/admin-refunds.ts:27 - аудит-middleware стоит до requireAdmin и пишет все запросы, включая отклонённые/анонимные, без actor; запись в журнал синхронная (appendFileSync) и бросает исключение при недоступном файле - 500 на любой запрос админки - minor
api/src/routes/admin-refunds.ts:95 - error-handler с 3 аргументами Express не считает обработчиком ошибок (нужны 4): он не вызывается, ошибки идут в общий errorHandler; также async-обработчики на Express 4 не пробрасывают отклонённые промисы - запрос зависает - major
api/src/routes/admin-refunds.ts:25 - express.json() повторно подключён в роутере, тело уже разобрано в app.ts - лишнее - minor
api/src/app.ts:94 - adminRefundsRouter монтируется после app.use(errorHandler): ошибки админских роутов не доходят до общего обработчика - major
api/src/audit.ts:13 - AUDIT_LOG читается лениво при первой записи, не при старте, с тихим fallback на audit.log в cwd; неверный путь/нет прав обнаружится при первом запросе - blocker
api/src/errors.ts:26 - стек исключения отдаётся клиенту в ответе 500 (details): утечка путей, внутренностей и версий всем пользователям API - blocker
api/src/server.ts:34 - SIGTERM делает process.exit(0) без server.close: обрываются активные запросы, в том числе возвраты между вызовом провайдера и сохранением; прежнее корректное закрытие удалено - major
api/src/refunds/refund-store.ts:36 - возвраты хранятся в памяти процесса (Map), при 2 репликах в k8s и рестартах теряются и расходятся между подами; дедупликация и суммирование возвратов по заказу не работают между репликами - major
api/src/refunds/refund-store.ts:12 - ...input не отфильтрован, а orderBalanceKopecks/providerRefundId не заданы при pending; возвраты в списке без пагинации - minor
api/src/config.ts:5 - REFUNDS_URL, REFUNDS_API_KEY, AUDIT_LOG не добавлены в config и не валидируются при старте - blocker
deploy/k8s.yaml:19 - образ с тегом :latest: деплой невоспроизводим, откат невозможен - major
deploy/k8s.yaml:41 - пробы /healthz, но такого эндпоинта в api нет: поды никогда не станут ready, liveness будет их перезапускать - blocker
deploy/k8s.yaml:62 - журнал аудита в emptyDir при replicas: 2: теряется при пересоздании пода и раздроблен по репликам - major
deploy/k8s.yaml:36 - ConfigMap/Secret shopdesk-api не включены в манифест, при отсутствии под не стартует (CreateContainerConfigError) - minor
api/test/admin-refunds.test.ts:56 - нет тестов на дубликат, превышение суммы по заказу, возврат без суммы, ошибку провайдера, PATCH (в т.ч. доступ клиента), 404 заказа; fetch замокан 202 без тела - критичные ветки не покрыты - major
