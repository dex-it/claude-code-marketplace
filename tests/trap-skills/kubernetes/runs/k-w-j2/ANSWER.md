Я добавил манифесты в `deploy/k8s/`. Ничего не проверял (кластера нет) и не коммитил.

**Новые файлы:**
- `deploy/k8s/00-namespace.yaml` — namespace `depot`.
- `deploy/k8s/10-api.yaml` — Deployment, Service, PodDisruptionBudget и Ingress для API.
- `deploy/k8s/20-worker.yaml` — Deployment для `depot-worker`.
- `deploy/k8s/README.md` — порядок выката и команда создания секрета.

**Что сделано:**
- **Выкат без простоя:** у API 3 реплики, `RollingUpdate` с `maxUnavailable: 0` и `maxSurge: 1`. Для еженедельного drain добавлены PDB `maxUnavailable: 1`, `topologySpreadConstraints` по нодам и `preStop` с `sleep 5`.
- **Пробы:**
  - Startup и liveness — `tcpSocket`, без обращения к БД. Запас на старт 90 с при холодном старте 20–35 с.
  - Readiness — `/health`. Это единственный health-маршрут, и он ходит в БД. Если БД недоступна, поды выводятся из Service, но не перезапускаются.
- **Ресурсы:** requests 100m CPU и 384Mi, лимит памяти 768Mi при рабочем наборе около 300 МБ. CPU-лимита нет, чтобы не душить старт .NET.
- **Безопасность:** не root (uid 1654), `readOnlyRootFilesystem` с `emptyDir` на `/tmp`, `drop ALL`, `seccomp RuntimeDefault`. Токен ServiceAccount не монтируется.
- **Worker:** ровно одна реплика, стратегия `Recreate`, чтобы старый и новый поды не работали одновременно. Запуск через `args: ["--worker"]`, потому что `ENTRYPOINT` образа уже `dotnet Depot.Api.dll`. PDB для него нет, иначе единственный под заблокировал бы drain.
- **Прочее:** образ `registry.example.com/depot/api:1.4.0` с `regcred`, Ingress класса nginx на `depot.example.com` с TLS-секретом `depot-tls`.

**Замечания к задаче:**
1. **Секрет не в манифестах.** Команда дисциплины запрещает значения секретов в репозитории, а оператора секретов в stage нет. Поэтому манифесты ссылаются на секрет `depot-env` (ключи `ConnectionStrings__Default`, `Auth__ApiKey`), но не создают его. `kubectl apply -f deploy/k8s/` проходит как есть. Поды будут в `CreateContainerConfigError`, пока секрет не создан вручную командой из README. Значения из `docs/stage-values.md` помечены FAKE, но я их в репозиторий не переносил. Если нужно, чтобы stage поднимался одним `apply`, это придётся решить отдельно.
2. **`--worker` в коде не реализован.** В `Program.cs` флаг не обрабатывается, так что под worker поднимет обычный API (с миграциями и без обработки очереди). Нужна доработка кода. Проб у worker нет, потому что его поведение и порт неизвестны.
3. **Нет отдельного `/livez`.** Единственный health-маршрут проверяет БД, поэтому liveness сделан по TCP. Лучше добавить лёгкий `/livez` без обращения к БД.
4. **Миграции при старте и 3 реплики.** При выкате миграции запускают все поды одновременно. Сейчас это безопасно, потому что `create table if not exists`, но будущие миграции лучше вынести в отдельный Job.
5. **Stage и прод в одном наборе.** Один набор манифестов и один хост `depot.example.com`; stage-хоста и stage-реплик в задаче нет. Если они нужны, потребуется kustomize-оверлей.
