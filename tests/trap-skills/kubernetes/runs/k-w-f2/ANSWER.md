Манифесты написаны в `deploy/k8s/`, ничего не закоммичено. Ни `kubectl`, ни сборки нет, так что манифесты не проверены, в том числе `kubectl apply`.

**Новые файлы в `deploy/k8s/`:**
- `00-namespace.yaml` — namespace `depot`. Префикс `00-` нужен, чтобы `kubectl apply -f` создал его первым.
- `api-deployment.yaml` — Deployment `depot-api` на 3 реплики и PodDisruptionBudget.
- `api-service.yaml` — ClusterIP, порт 80 на 8080.
- `api-ingress.yaml` — класс nginx, хост `depot.example.com`, TLS из `depot-tls`.
- `worker-deployment.yaml` — Deployment `depot-worker`, тот же образ, `args: ["--worker"]`.
- `README.md` — порядок применения и команда создания секрета.

**Решения:**
- **Выкат без простоя:** RollingUpdate с `maxUnavailable: 0` и `maxSurge: 1`. Для drain нод добавлены PDB `minAvailable: 2`, `topologySpreadConstraints` по нодам и `preStop` с `sleep 10`.
- **Пробы API:** `/health` ходит в БД, поэтому он только в readiness. Liveness и startup — `tcpSocket` на 8080. Запас на старт 150 с при холодном старте до 35 с.
- **Ресурсы:** requests и limits заданы у обоих контейнеров. API и воркер получили одинаковые значения: 100m/384Mi и 500m/512Mi. Они выбраны по замерам из runbook.
- **Worker:** `replicas: 1` и стратегия `Recreate`, чтобы два экземпляра не работали одновременно.
- **Безопасность:** оба Deployment запускаются non-root (1654), с `readOnlyRootFilesystem` и `drop ALL`. Для записи смонтирован `emptyDir` в `/tmp`.
- **Секреты:** значений секретов в репозитории нет. Deployment берёт `ConnectionStrings__Default` и `Auth__ApiKey` через `secretKeyRef` из секрета `depot-env`.

**Замечания к задаче:**
1. **Секрет `depot-env` нужно создать вручную.** Секрет с значениями в манифесте запрещён дисциплиной, а оператора секретов на stage нет. Поэтому `kubectl apply -f deploy/k8s/` применится, но поды будут в `CreateContainerConfigError`, пока секрет не создан. Команда лежит в `README.md`. Значения для stage берутся из `docs/stage-values.md`.
2. **Воркера в коде нет.** В `Program.cs` флага `--worker` нет, поэтому с этим образом `depot-worker` запустится как обычный API. Возможно, это отдельная задача. Проб у воркера нет, пока непонятно, слушает ли он порт.
3. **Воркер не защищён от drain.** PDB для него не делал: `minAvailable: 1` заблокировал бы drain нод. Во время drain воркер кратко остановится.
4. **Расхождение с git log.** В истории есть коммит «DPT-11: манифесты Kubernetes», но `deploy/k8s/` не было ни в дереве, ни в `git ls-files`. Манифесты я создал заново.
