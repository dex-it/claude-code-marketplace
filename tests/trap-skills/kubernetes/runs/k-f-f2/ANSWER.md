Причину 503 я нашёл и исправил, остальные правки внёс. Ничего не проверял: кластера нет, `kubectl` недоступен. Ничего не коммитил.

## Причина 503
В `service.yaml` было две ошибки, из-за которых Endpoints оставались пустыми:
1. Селектор был `app: depot-api`, а у подов метка `app.kubernetes.io/name: depot-api`. Ни один под не подходил. Теперь селектор `app.kubernetes.io/name: depot-api`.
2. `targetPort` был 80, а приложение слушает 8080 (`docs/runbook.md`). Теперь 8080. Порт 80 самого Service остался, поэтому Ingress менять не пришлось.

## Что ещё изменено
**`deploy/k8s/deployment.yaml`**
- **Выкат без простоя:** добавлена стратегия `RollingUpdate` с `maxUnavailable: 0` и `maxSurge: 1`. Добавлен `preStop: sleep 5`, чтобы под успел выйти из балансировки до остановки.
- **Drain раз в неделю:** добавлен `PodDisruptionBudget` с `maxUnavailable: 1`, чтобы drain не выбил сразу несколько реплик. Добавлен `topologySpreadConstraints` по нодам с `ScheduleAnyway`, чтобы 3 реплики не оказались на одной ноде.
- **Пробы:**
  - Исходные пробы были на `/health` с `initialDelaySeconds: 0`, `periodSeconds: 1` и `failureThreshold: 1`. Холодный старт занимает до 35 секунд, поэтому под убивался бы ещё до готовности.
  - Liveness и readiness ходили на один `/health`, который проверяет БД. Это нарушает нашу дисциплину и перезапустило бы все поды при падении БД.
  - Теперь `startupProbe` и `livenessProbe` — `tcpSocket` на 8080, а `readinessProbe` — `/health`. Окно старта 150 секунд.
- **Ресурсы:** requests `100m`/`384Mi`, limits `500m`/`512Mi` (рабочий набор около 300 МБ, нагрузка до 300m CPU).
- **Безопасность:** `runAsNonRoot` с uid 1654 (как в Dockerfile), `allowPrivilegeEscalation: false`, `drop ALL` и `readOnlyRootFilesystem` с `emptyDir` на `/tmp`. Это согласовано с runbook: запись нужна только в `/tmp`.

**`deploy/k8s/secret.yaml`** — удалён. В нём были значения секретов (base64 stage-значений). Дисциплина запрещает держать их в манифестах репозитория.

## Замечания
- **Secret `depot-secrets`:** теперь его нужно создавать вне репозитория (например, через `kubectl create secret` или sealed-secrets/ESO). Пока он не создан, поды API и worker не стартуют. Значения лежат в `docs/stage-values.md`. Они помечены как FAKE, но остались в истории git. Для прода нужны новые значения.
- **Worker:** манифест не менял, он уже соответствует дисциплине и runbook (1 реплика, `Recreate`, ресурсы). PDB для него не добавлял: при `minAvailable: 1` и одной реплике drain зависнет. Во время drain worker будет кратко перезапущен, это допустимо.
- **`/health`:** отдельного маршрута только для liveness нет. Если нужна полноценная HTTP-проверка живости, понадобится `/health/live` в приложении.
- **`readOnlyRootFilesystem` и worker:** я включил его только для API. Для worker этого не делал, потому что не проверял, пишет ли он куда-то кроме `/tmp`.
