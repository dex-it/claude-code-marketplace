Манифесты для `Depot.Api` и `depot-worker` готовы в `deploy/k8s/`. Я ничего не коммитил. Применить и проверить их было нечем, поэтому `kubectl apply` не запускался.

**Новые файлы:**
- `deploy/k8s/namespace.yaml`: namespace `depot`.
- `deploy/k8s/secret.yaml`: Secret `depot-settings` с `ConnectionStrings__Default` и `Auth__ApiKey`. Значения взяты из `docs/stage-values.md`.
- `deploy/k8s/api.yaml`: Deployment `depot-api`, Service, PodDisruptionBudget и Ingress.
  - Выкат без простоя: 3 реплики, `maxUnavailable: 0` и `maxSurge: 1`.
  - Drain нод: PDB `minAvailable: 2`, плюс `topologySpreadConstraints` по нодам.
  - Пробы: startup-проба на `/health` с запасом до 120 с под холодный старт, readiness на `/health`.
  - Ingress: класс nginx, хост `depot.example.com`, TLS-secret `depot-tls`.
  - Образ `registry.example.com/depot/api:1.4.0` и pull-secret `regcred`.
- `deploy/k8s/worker.yaml`: Deployment `depot-worker`, 1 реплика, стратегия `Recreate`, запуск `dotnet Depot.Api.dll --worker`.

Контейнеры запускаются под пользователем 1654 (как в Dockerfile), с read-only корневой ФС и `emptyDir` в `/tmp`. Ресурсы: requests 100m CPU и 384Mi у API, 50m CPU и 384Mi у воркера; лимит памяти 512Mi у обоих.

**Замечания:**
1. **Прод-секрет.** Чтобы `kubectl apply -f deploy/k8s/` работал как есть, а оператора секретов нет, в `secret.yaml` лежат тестовые значения stage. Для прода нужно создать настоящий `depot-settings` отдельно, команда в комментарии файла. Иначе повторный apply перезапишет его.
2. **Liveness.** В `/health` есть проверка БД, поэтому liveness сделан через `tcpSocket`. Иначе при сбое БД Kubernetes перезапускал бы все поды.
3. **Миграции.** Приложение применяет миграции при старте, и 3 реплики API плюс воркер могут делать это одновременно. Безопасность параллельного запуска в `Migrator.cs` я не проверял. Если блокировки нет, лучше вынести миграции в Job.
4. **Воркер.** Проб у него нет: в runbook не описано, слушает ли он порт или как проверять его здоровье. PDB для него тоже нет, иначе он заблокировал бы drain. При drain воркер просто перезапускается на другой ноде.
5. **Лимит CPU.** Я его не задавал, чтобы не душить под нагрузкой (до 300m). Если кластеру нужен лимит, его легко добавить.
6. **Файл `secret.yaml`.** Он содержит значения stage. Если в репозиторий их класть не хотят, его можно убрать и создавать секрет вручную.
