Я добавил манифесты в `deploy/k8s/`, ничего не коммитил. Проверить их нечем: kubectl, кластера и сети нет, `kubectl apply` не запускался.

**Новые файлы:**
- `deploy/k8s/00-namespace.yaml` — namespace `depot`.
- `deploy/k8s/10-secret.yaml` — Secret `depot-env` с `ConnectionStrings__Default` и `Auth__ApiKey`. Значения взяты из `docs/stage-values.md`, это тестовые FAKE-значения.
- `deploy/k8s/20-api.yaml` — Deployment, Service, PodDisruptionBudget и Ingress для API:
  - Deployment `depot-api` на 3 реплики с образом `registry.example.com/depot/api:1.4.0` и `imagePullSecrets: regcred`. Выкат идёт с `maxUnavailable: 0` и `maxSurge: 1`, поды распределяются по нодам.
  - PodDisruptionBudget с `minAvailable: 2`, чтобы еженедельный drain нод не оставил меньше двух готовых реплик.
  - Startup-проба по TCP с запасом 150 с на миграции, readiness-проба `GET /health`, liveness-проба по TCP. Liveness сделан не по `/health` намеренно: он зависит от БД, и при её сбое все поды ушли бы в перезапуск.
  - Ingress с классом nginx, хостом `depot.example.com` и TLS-секретом `depot-tls`, Service на порт 80 → 8080.
  - Поды запускаются от пользователя 1654, корневая ФС только для чтения, `/tmp` — emptyDir, все capabilities сброшены. Ресурсы: requests 100m CPU и 384Mi, лимит памяти 512Mi (по замерам рабочий набор около 300 МБ).
- `deploy/k8s/30-worker.yaml` — Deployment `depot-worker`: 1 реплика, стратегия Recreate, чтобы при выкате не было двух экземпляров. Образ тот же, аргумент `--worker` передаётся в ENTRYPOINT `dotnet Depot.Api.dll`.

**Замечания:**
1. Secret со stage-значениями лежит в том же каталоге, который применяется целиком. Для прода `depot-env` надо создавать отдельно, иначе в прод уйдут тестовые ключ и пароль. Лучше вынести stage-значения в overlay или отдельный каталог.
2. В `Program.cs` нет режима `--worker`: аргумент не обрабатывается, и `depot-worker` запустит обычный API. Если так и есть, worker не будет разбирать очередь, а запустит ещё один API с миграциями. Нужно уточнить у разработчиков.
3. У worker нет проб: его health-эндпоинт в runbook не описан. Для worker не настроен и PodDisruptionBudget, чтобы он не блокировал drain.
4. Одна реплика worker означает короткий простой при выкате и при drain ноды. Это следствие требования «ровно один экземпляр».
5. Образ `1.4.0` указан тегом, без digest. Пины digest лучше делать в CI.
