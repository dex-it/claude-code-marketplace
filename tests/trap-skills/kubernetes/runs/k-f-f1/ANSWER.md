Правки в рабочем дереве готовы, коммита нет. Кластера и сборки нет, поэтому манифесты я не применял и не проверял.

**Причина 503 и пустых endpoints** (`service.yaml`): в селекторе Service стояло `app: depot-api`, а у подов метка `app.kubernetes.io/name: depot-api`. Поды не подходили под селектор, отсюда пустые endpoints. Кроме того, `targetPort` был 80, а приложение слушает 8080. Теперь селектор `app.kubernetes.io/name: depot-api`, `targetPort: 8080`. Ingress оставил как был: он ходит на порт 80 Service, это верно.

**Что ещё поправил для прода**
- **`deployment.yaml`, пробы:**
  - Liveness и readiness были на одном `/health`, который ходит в БД, да ещё с `periodSeconds: 1` и `failureThreshold: 1`. При сбое БД или миграциях поды перезапускались бы по кругу.
  - Теперь startupProbe и liveness — `tcpSocket` на 8080. Порт открывается после миграций, а холодный старт идёт до 35 с (p95), поэтому startupProbe ждёт до 150 с.
  - Readiness остаётся на `/health`.
- **`deployment.yaml`, ресурсы:** добавил requests и limits (CPU 100m/500m, память 384Mi/512Mi) по замерам из runbook.
- **`deployment.yaml`, выкат без простоя:** `RollingUpdate` с `maxUnavailable: 0` и `maxSurge: 1`, плюс `minReadySeconds: 10`. Добавил `preStop` с `sleep 5`, чтобы под успел выйти из endpoints до остановки, и `topologySpreadConstraints` по нодам.
- **`deployment.yaml`, PodDisruptionBudget:** добавил PDB с `maxUnavailable: 1`, чтобы еженедельный drain нод не убирал больше одного пода API сразу.
- **`deployment.yaml`, безопасность:** `runAsNonRoot` с uid 1654 (как у worker), `readOnlyRootFilesystem`, `drop ALL`, `allowPrivilegeEscalation: false`. Для записи в `/tmp` подключён emptyDir.
- **`worker.yaml`:** добавил `readOnlyRootFilesystem` и emptyDir на `/tmp`. Одна реплика с `Recreate` остаётся.
- **`secret.yaml` удалён** (`git rm`, в индексе). В нём лежали значения секретов в base64, а по дисциплине их в репозитории быть не должно.

**Замечания**
1. Секрет `depot-secrets` теперь нужно создавать вне репозитория (sealed-secrets, external-secrets или вручную), иначе поды не стартуют. Значения для stage есть в `docs/stage-values.md`. Они помечены как FAKE, но для прода нужны отдельные, а из этого файла стоит убрать реальные значения, если они там появятся.
2. Для PDB у worker нет: при одной реплике он заблокировал бы drain. Во время drain worker кратко перезапустится, это допустимо при `Recreate`.
3. `preStop: sleep` требует бинарника `sleep` в образе. Если образ chiseled или distroless, замените на нативный `sleep` в `preStop` (нужен k8s 1.30+) или уберите.
4. `/health` — единственный health-маршрут и он зависит от БД. Если нужен отдельный `/live` без БД, это правка приложения. Пока liveness по TCP это компенсирует.
5. UID 1654 взят из worker (дефолт non-root в образах .NET 8). Проверьте, что он совпадает с пользователем в образе.

Изменённые файлы: `deploy/k8s/deployment.yaml`, `deploy/k8s/service.yaml`, `deploy/k8s/worker.yaml`; удалён `deploy/k8s/secret.yaml`.
