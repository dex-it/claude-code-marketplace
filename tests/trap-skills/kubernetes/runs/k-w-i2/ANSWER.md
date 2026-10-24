Манифесты для `Depot.Api` и `depot-worker` готовы в рабочем дереве, ничего не закоммичено. Ни сборки, ни кластера, ни `kubectl` не было, так что YAML я не проверял.

**Новые файлы в `deploy/k8s/`:**
- `namespace.yaml` — namespace `depot`.
- `api-deployment.yaml` — 3 реплики и образ `registry.example.com/depot/api:1.4.0` с `regcred`.
  - Выкат идёт с `maxUnavailable: 0` и `maxSurge: 1`. Контейнер работает от пользователя 1654 с read-only корнем, а `/tmp` вынесен в `emptyDir`.
  - Ресурсы: запрос 100m CPU и 384Mi памяти, лимит памяти 512Mi. Лимит CPU не задан.
- `api-service.yaml` — порт 80 на порт 8080 пода.
- `api-pdb.yaml` — `minAvailable: 2`, чтобы еженедельный drain нод не останавливал сразу несколько подов API.
- `ingress.yaml` — класс nginx, хост `depot.example.com`, TLS-secret `depot-tls`.
- `worker-deployment.yaml` — `replicas: 1` со стратегией `Recreate`, чтобы при выкате не работали два воркера сразу. Запуск с `args: ["--worker"]`.
- `README.md` — как применить манифесты и создать secret.

**Пробы.** `/health` ходит в БД, а других health-маршрутов нет. Поэтому по дисциплине liveness и readiness не стоят на одной проверке:
- readiness — `GET /health`;
- liveness — `tcpSocket` на 8080, чтобы падение БД не перезапускало все поды;
- `startupProbe` — `tcpSocket` с окном около 120 с под миграции (холодный старт 20–35 с).

**Секреты.** Значений в манифестах нет. Поды берут настройки из secret `depot-settings`, его надо создать вручную по `deploy/k8s/README.md`.

**Замечания:**
1. `kubectl apply -f deploy/k8s/` применится как есть, но до создания `depot-settings` поды будут в `CreateContainerConfigError`. Secret с значениями из `docs/stage-values.md` нужно создать после namespace. Включить его в манифесты без оператора секретов значило бы положить значения в репозиторий. Если нужен другой компромисс, решайте вы.
2. В `Program.cs` нет обработки `--worker`: запуск `dotnet Depot.Api.dll --worker` поднимет обычный API, а не воркер. Для воркера вдобавок задан только `ConnectionStrings__Default`/`Auth__ApiKey`, как в runbook. Пока режим воркера не реализован в коде, `depot-worker` в кластере работать не будет.
3. У воркера нет проб: в runbook для него нет health-эндпоинта.
4. Ресурсы подобраны по замерам из runbook, на прод их стоит перепроверить.
