Исправил причину 503 и подготовил манифесты к проду. Ничего не применял и не проверял на кластере (там только git), и коммита нет.

**Причина 503.** В `service.yaml` было две ошибки:
- Селектор `app: depot-api` не совпадал с меткой подов `app.kubernetes.io/name: depot-api`. Из-за этого у Service не было endpoints, и Ingress отдавал 503.
- `targetPort: 80`, а приложение слушает 8080 (см. `docs/runbook.md`). Если бы остался только этот дефект, endpoints появились бы, но трафик шёл бы не на тот порт.

**Изменённые файлы**
- `deploy/k8s/service.yaml`: селектор теперь `app.kubernetes.io/name: depot-api`, `targetPort: 8080`.
- `deploy/k8s/deployment.yaml`:
  - **Выкат без простоя:** `RollingUpdate` с `maxUnavailable: 0` и `maxSurge: 1`. В `preStop` добавлен `sleep 5`, чтобы под успел выйти из endpoints до остановки. `terminationGracePeriodSeconds` равен 30.
  - **Пробы:**
    - Добавлена `startupProbe` на `/health` с запасом до 120 с (холодный старт с миграциями идёт до 35 с).
    - Старый liveness (`/health`, период 1 с, порог 1, без задержки) убивал бы под ещё до конца миграций, поэтому я заменил его. Новый liveness проверяет только TCP-порт (период 10 с, порог 3), потому что `/health` зависит от БД. Если БД упадёт, поды не будут рестартовать все сразу.
    - Readiness остаётся на `/health`, добавлены `timeoutSeconds` и `failureThreshold`.
  - **Ресурсы:** requests `100m` CPU и `384Mi` памяти, limits `500m` и `512Mi`. Это исходя из замеров в runbook: около 300 МБ рабочий набор, до 300m CPU под нагрузкой.
  - **Безопасность:** `runAsNonRoot` с uid 1654 (как у worker), seccomp `RuntimeDefault`, `allowPrivilegeEscalation: false`, `drop ALL` и `readOnlyRootFilesystem`. Запись разрешена только в `/tmp` через `emptyDir`, как требует runbook. Пустой `securityContext: {}` убран.
  - **Распределение по нодам:** `topologySpreadConstraints` по hostname, чтобы реплики не оказались на одной ноде.
  - **Порт:** он получил имя `http`, и пробы ссылаются на него.
- `deploy/k8s/pdb.yaml` (новый): `PodDisruptionBudget` с `minAvailable: 2`. Еженедельный drain нод будет выводить поды по одному, и при 3 репликах сервис останется доступным.

**Замечания**
- **Worker:** у `depot-worker` ровно одна реплика с `Recreate`, поэтому при drain его ноды обработка очереди ненадолго остановится. PDB для него я не добавлял: `minAvailable: 1` заблокировал бы drain. Это допустимо, только если очередь переживает паузу.
- **Worker:** я его не менял. Нет проб (неизвестно, слушает ли он порт в режиме `--worker`) и нет `readOnlyRootFilesystem` (не знаю, пишет ли он вне `/tmp`). Стоит уточнить у разработчиков.
- **Secret:** `secret.yaml` содержит значения FAKE для stage (base64 лежит в git). В проде секреты нужно брать из внешнего хранилища (sealed-secrets или external-secrets), а не из репозитория. Я файл не трогал.
- **Образ:** тег `1.4.0` зафиксирован, это нормально. Для воспроизводимости можно перейти на digest.
- **Ingress:** манифест корректен, он смотрит на порт 80 Service. Аннотации (размер тела запроса, таймауты) в задаче не требовались, и я их не добавлял.
