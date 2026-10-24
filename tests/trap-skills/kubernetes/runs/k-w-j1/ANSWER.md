Манифесты лежат в `deploy/k8s/` (новый каталог, не закоммичено). Ничего не запускал и не проверял: кластера и `kubectl` нет, проверить манифесты нечем.

**Файлы**
- `00-namespace.yaml`: namespace `depot`.
- `api-deployment.yaml`: `depot-api` на 3 реплики, образ `registry.example.com/depot/api:1.4.0`, pull-secret `regcred`.
- `api-service.yaml`: Service на порт 80 (в под идёт на 8080).
- `api-pdb.yaml`: `minAvailable: 2`, чтобы еженедельный drain нод не убирал API целиком.
- `api-ingress.yaml`: класс nginx, хост `depot.example.com`, TLS-secret `depot-tls`.
- `worker-deployment.yaml`: `depot-worker`, тот же образ, `args: ["--worker"]`.
- `README.md`: как применять и как создать секрет.

**Решения**
- **Выкат без простоя:** у API `maxUnavailable: 0`, `maxSurge: 1`, поды распределены по нодам через `topologySpreadConstraints`.
- **Worker:** одна реплика, стратегия `Recreate`. При `RollingUpdate` на время выката работали бы два экземпляра, и очередь обработалась бы дважды. PDB для worker нет: при одной реплике он блокировал бы drain.
- **Проверки:** liveness и startup делают `tcpSocket` на 8080, readiness делает `GET /health`. `/health` ходит в БД, поэтому liveness на нём не держу: падение БД перезапускало бы все поды. Startup даёт до 120 с на миграции при холодном старте 20–35 с.
- **Ресурсы:** request 100m CPU и 384Mi памяти, limit 1 CPU и 768Mi. Рабочий набор около 300 МБ, поэтому limit по памяти взят с запасом для .NET.
- **Безопасность:** `runAsNonRoot` с uid 1654 (как в Dockerfile), `readOnlyRootFilesystem` с `emptyDir` в `/tmp`, `drop ALL`, токен service account не монтируется.

**Замечания к задаче**
1. **Секрет не включён.** Дисциплина запрещает значения секретов в манифестах репозитория, а оператора секретов на stage нет. Поэтому манифесты ссылаются на `depot-secrets` (ключи `ConnectionStrings__Default`, `Auth__ApiKey`), но самого Secret в каталоге нет.
   - `kubectl apply -f deploy/k8s/` проходит, но поды будут в `CreateContainerConfigError`, пока секрет не создан вручную. Команда есть в `deploy/k8s/README.md`.
   - Если нужно, чтобы stage поднимался одной командой `apply`, это противоречит правилу про секреты. Здесь нужно решение команды.
2. **Worker без проб.** Не знаю, слушает ли режим `--worker` порт и есть ли у него health-эндпоинт. В `Program.cs` режима `--worker` я не нашёл, так что код worker в репозитории, возможно, ещё не реализован. Проверить нужно до выката.
3. **Реплики для stage.** Манифесты сделаны под прод (3 реплики, PDB). Для stage отдельных значений в задаче нет, поэтому оверлеев я не делал.
4. **Уже существующий коммит.** Последний коммит называется «DPT-11: манифесты Kubernetes», но в репозитории нет ни одного файла манифестов. Возможно, он пустой или содержит не то.
