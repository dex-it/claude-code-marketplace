Манифесты лежат в `deploy/k8s/`. Ничего не коммитил и ничего не проверял: кластера нет, `kubectl` недоступен, а YAML я не валидировал.

**Новые файлы**
- `deploy/k8s/namespace.yaml` — namespace `depot`.
- `deploy/k8s/secret.yaml` — Secret `depot-settings` со значениями stage из `docs/stage-values.md` (там FAKE-значения). Секрет лежит в репозитории, чтобы `kubectl apply -f deploy/k8s/` работал как есть.
- `deploy/k8s/api.yaml` — Deployment, Service, PodDisruptionBudget и Ingress для API.
- `deploy/k8s/worker.yaml` — Deployment для `depot-worker`.

**Что заложено**
- **API:**
  - Образ `registry.example.com/depot/api:1.4.0`, pull-secret `regcred`, порт 8080, 3 реплики.
  - Выкат без простоя: `maxUnavailable: 0`, `maxSurge: 1`, `preStop sleep 5`, реплики разносятся по нодам.
  - `PodDisruptionBudget` с `minAvailable: 2`, чтобы еженедельный drain нод не останавливал сервис.
  - Пробы: `startupProbe` и `readinessProbe` бьют в `/health`, на старт отведено до 150 с при p95 в 35 с. `livenessProbe` — только TCP, без проверки БД: если БД недоступна, перезапуск подов не поможет.
- **Ingress:** класс nginx, хост `depot.example.com`, TLS-secret `depot-tls`.
- **Worker:**
  - Тот же образ, команда `dotnet Depot.Api.dll --worker`, `replicas: 1`.
  - Стратегия `Recreate`, чтобы при выкате не работали два экземпляра сразу.
  - PDB для него нет: при единственной реплике он заблокировал бы drain нод.
- **Общее:**
  - Настройки идут через `envFrom` из секрета.
  - Контейнеры запускаются от uid 1654, с `readOnlyRootFilesystem` и `emptyDir` в `/tmp`.
  - Ресурсы взяты из замеров: request 100m CPU и 384Mi памяти, limit памяти 512Mi, limit CPU не задан.

**Замечания к задаче**
1. Секрет с настройками одновременно нужен в репозитории (чтобы apply работал без оператора) и не должен содержать боевых данных. Поэтому `secret.yaml` — только для stage. Для прода его надо не применять, а создавать `depot-settings` отдельно с реальными значениями. Лучше вынести stage-секрет в отдельный каталог или kustomize-overlay: `apply -f deploy/k8s/` сейчас перезапишет прод-секрет фейковыми значениями.
2. В `Program.cs` нет обработки `--worker`: приложение просто стартует как обычный API и ждёт `/health`. Если режим worker не реализован, под запустится как второй API. Проверьте это до выкатки.
3. У worker нет проб, потому что `/health` в его режиме не описан. Если он тоже слушает 8080, readiness и liveness можно добавить.
4. Реплики API распределяются по нодам через `topologySpreadConstraints` с `ScheduleAnyway`. Это мягкое условие: на маленьком кластере все три пода могут оказаться на одной ноде. Если нужна гарантия, замените на `DoNotSchedule`.
5. Миграции выполняются при старте каждого пода. При выкате несколько подов могут мигрировать одновременно, и защита от этого в `Migrator.cs` не проверялась.
6. Тег `1.4.0` зафиксирован в двух местах (`api.yaml` и `worker.yaml`), его надо менять синхронно.
