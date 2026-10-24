Я поправил Service и подготовил манифесты к проду. Ничего не коммитил. Проверить не мог: кластера и сети нет, `kubectl` не запускал.

**Причина 503 и пустых endpoints** — `service.yaml` не совпадал с подами в двух местах:
- Селектор был `app: depot-api`, а у подов стоит лейбл `app.kubernetes.io/name: depot-api`. Из-за этого Service не находил ни одного пода. Теперь селектор `app.kubernetes.io/name: depot-api`.
- `targetPort` был 80, хотя приложение слушает 8080 (по runbook). Теперь `targetPort: 8080`.

**Что ещё изменил**

`deployment.yaml` (API):
- **Выкат без простоя:** `RollingUpdate` с `maxUnavailable: 0` и `maxSurge: 1`.
- **Пробы:**
  - Прежний liveness (`periodSeconds: 1`, `failureThreshold: 1`, без задержки) убивал под при первом же сбое. Холодный старт занимает 20–35 с (миграции), так что поды ушли бы в crash-loop.
  - Добавил `startupProbe` с запасом до 120 с.
  - Liveness смягчил: период 10 с, 6 неудач, таймаут 3 с.
  - Readiness: таймаут 3 с, 3 неудачи.
- **Плавная остановка:** `preStop` с `sleep 5` и `terminationGracePeriodSeconds: 45`, чтобы под успел выйти из endpoints до остановки.
- **Ресурсы:** requests 100m CPU / 384Mi, limits 500m / 512Mi. Это моя оценка по замерам из runbook (около 300 МБ, 50–300m), так что проверьте на нагрузке.
- **Безопасность:**
  - `runAsNonRoot` с uid 1654 и `seccomp RuntimeDefault`.
  - `allowPrivilegeEscalation: false`, `drop ALL`, `readOnlyRootFilesystem`.
  - Запись разрешена только в `/tmp`, он смонтирован как `emptyDir`.
- **Размещение:** `topologySpreadConstraints` по хостам с `ScheduleAnyway`, чтобы реплики не сели на одну ноду.

`pdb.yaml` (новый): `minAvailable: 2` для `depot-api`. Еженедельный drain нод не должен выбивать больше одной реплики за раз.

`worker.yaml`: добавил `readOnlyRootFilesystem` и `emptyDir` на `/tmp`. Одну реплику и `Recreate` оставил как были. PDB для воркера не делал: при `minAvailable: 1` drain ноды с воркером зависнет.

**Замечания к задаче**
1. `secret.yaml` лежит в репозитории с base64-значениями. Сейчас там FAKE-значения для stage, но для прода секрет нужно подставлять вне git (sealed-secrets, external-secrets или CI). Файл не менял.
2. `/health` проверяет БД. Если Postgres недоступен, readiness уберёт все поды из endpoints, а liveness после ~60 с их перезапустит. Отдельного health-маршрута без БД нет, поэтому лучше добавить `/live` в приложении.
3. Образ закреплён по тегу `1.4.0`, не по digest. Для прода лучше закрепить по digest.
4. Ingress, судя по файлу, корректен: backend `depot-api:80` теперь совпадает с Service. Существование `depot-tls` и `regcred` в кластере не проверял.
5. Для воркера нет проб. Он не слушает порт, а механизма проверки в runbook нет.
