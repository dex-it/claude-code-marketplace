---
name: kubernetes
description: Kubernetes — ловушки, ресурсы, probes, безопасность. Активируется при kubernetes, k8s, deployment, pod, service, ingress, helm, HPA, kubectl, namespace, configmap, secret, liveness, readiness, cluster, kustomize
---

# Kubernetes — ловушки и anti-patterns

## Probes

### Одинаковые liveness и readiness
Плохо: обе probe на `/health` с проверкой БД
Правильно: liveness = `/health/live` (процесс жив, без проверок зависимостей), readiness = `/health/ready` (проверяет DB/Redis)
Почему: БД упала → liveness fail → Kubernetes restart → БД всё ещё лежит → restart loop → все pods в CrashLoopBackOff

### Агрессивные probe настройки
Плохо: `initialDelaySeconds: 0`, `periodSeconds: 1`, `failureThreshold: 1` — instant kill
Правильно: `startupProbe` с `failureThreshold: 30, periodSeconds: 10` для медленного старта. Liveness: `failureThreshold: 3`
Почему: .NET приложение стартует 5-30 сек. Без startupProbe — liveness убивает pod до завершения инициализации → вечный restart

### Нет startupProbe
Плохо: только liveness/readiness → `initialDelaySeconds: 60` как костыль
Правильно: startupProbe заменяет liveness на время старта, потом передаёт контроль
Почему: initialDelaySeconds — статичное число. Если app стартует быстрее — лишнее ожидание. Медленнее — restart

## Resources

### Нет requests/limits — OOMKill node
Плохо: pod без `resources:` → QoS = BestEffort → убивается первым при нехватке памяти
Правильно: requests (гарантированный минимум) + limits (потолок)
Почему: один pod без limits съедает всю память node → OOMKiller убивает случайные pods, включая критичные

### Limits слишком низкие для .NET
Плохо: `memory: 64Mi, cpu: 50m` — .NET Runtime минимум ~80MB, GC тормозит на < 100m CPU
Правильно: для .NET API: requests `256Mi/100m`, limits `512Mi/500m` — стартовые значения, мониторь реальное потребление
Почему: GC .NET адаптируется к доступной памяти. Мало CPU → GC дольше → pauses → latency spikes

| QoS класс | Условие | Приоритет |
|-----------|---------|-----------|
| Guaranteed | requests == limits | Высший — убивается последним |
| Burstable | requests < limits | Средний |
| BestEffort | нет requests/limits | Низший — убивается первым |

## Security

### Пустой securityContext — root + все capabilities
Плохо: `securityContext: {}` — контейнер от root с полными capabilities
Правильно: `runAsNonRoot: true, runAsUser: 1000, allowPrivilegeEscalation: false, capabilities: { drop: ["ALL"] }, readOnlyRootFilesystem: true`
Почему: root в контейнере + уязвимость = container escape → доступ к host. Capabilities = то что может делать процесс (NET_RAW, SYS_ADMIN)

### Secrets в манифестах
Плохо: `data: { password: base64("s3cret") }` в git — base64 ≠ шифрование
Правильно: Sealed Secrets, External Secrets Operator, или HashiCorp Vault
Почему: base64 декодируется мгновенно. Secret в git = secret публичен для всех с доступом к репо

## Deployment

### maxUnavailable > 0 для production
Плохо: default `maxUnavailable: 25%` — 25% pods недоступны во время rollout
Правильно: `maxUnavailable: 0, maxSurge: 1` для zero downtime
Почему: при 4 pods и maxUnavailable=25% → один pod убит до запуска нового → capacity drop → latency spike

### Labels не совпадают → pod не получает трафик
Плохо: `deployment.spec.selector.matchLabels` ≠ `service.spec.selector` → Service не находит pods
Правильно: одинаковые labels в Deployment selector, Pod template, и Service selector
Почему: Kubernetes silent fail — нет ошибки, просто `kubectl get endpoints` показывает 0. Трафик идёт в никуда

### Нет PodDisruptionBudget
Плохо: node drain → все pods одного deployment убиты одновременно
Правильно: `PodDisruptionBudget: minAvailable: 1` (или `maxUnavailable: 1`)
Почему: cluster upgrade, node maintenance → drain → все replicas на одном node → downtime

## Troubleshooting ловушки

### CrashLoopBackOff — смотришь текущие логи вместо предыдущих
Плохо: `kubectl logs pod` — pod уже рестартнулся, логи пусты
Правильно: `kubectl logs pod --previous` — логи предыдущего инстанса с причиной crash
Почему: при crash контейнер перезапускается, текущие логи = новый чистый старт. Причина в предыдущих
