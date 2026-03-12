---
name: kubernetes
description: Kubernetes — ловушки, ресурсы, probes, безопасность. Активируется при kubernetes, k8s, deployment, pod, service, ingress, helm, HPA
allowed-tools: Read, Grep, Glob
---

# Kubernetes

## Правила

- Всегда указывай requests и limits
- Liveness ≠ Readiness — разные endpoints
- SecurityContext: runAsNonRoot, drop ALL capabilities
- Secrets не в манифестах — через Sealed Secrets / Vault
- Rolling update с maxUnavailable=0 для zero downtime
- Namespace per environment

## Частые ошибки

### Probes

```yaml
# Плохо — одинаковые liveness и readiness
livenessProbe:
  httpGet: { path: /health, port: 8080 }
readinessProbe:
  httpGet: { path: /health, port: 8080 }
# Если БД упала → readiness fail → restart → БД всё ещё лежит → restart loop

# Хорошо — liveness проверяет процесс, readiness проверяет зависимости
livenessProbe:
  httpGet: { path: /health/live, port: 8080 }   # "я жив" — без проверок DB/Redis
readinessProbe:
  httpGet: { path: /health/ready, port: 8080 }  # "я готов принимать трафик" — с проверками
startupProbe:
  httpGet: { path: /health/live, port: 8080 }
  failureThreshold: 30                           # даёт 5 мин на старт
  periodSeconds: 10

# Плохо — агрессивные probes, app не успевает стартовать
livenessProbe:
  initialDelaySeconds: 0   # сразу проверяет
  periodSeconds: 1         # каждую секунду
  failureThreshold: 1      # одна ошибка = restart
```

### Resources

```yaml
# Плохо — нет limits → OOMKill всего node
containers:
- name: myapp
  image: myapp:1.0.0
  # resources: ??? — без них pod = BestEffort, убивается первым

# Плохо — limits слишком низкие для .NET
resources:
  limits:
    memory: "64Mi"   # .NET Runtime минимум ~80MB
    cpu: "50m"       # GC будет тормозить

# Хорошо — .NET API типичные значения
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### QoS классы

| Класс | Условие | Приоритет |
|-------|---------|-----------|
| Guaranteed | requests == limits | Высший — убивается последним |
| Burstable | requests < limits | Средний |
| BestEffort | нет requests/limits | Низший — убивается первым |

### Security

```yaml
# Плохо — root, все capabilities, writable filesystem
spec:
  containers:
  - name: myapp
    securityContext: {}  # всё по умолчанию = небезопасно

# Хорошо — минимальные привилегии
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
  containers:
  - name: myapp
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop: ["ALL"]
      readOnlyRootFilesystem: true
```

### Deployment strategy

```yaml
# Zero downtime
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0   # всегда N pods доступны

# Для миграций с downtime
strategy:
  type: Recreate
```

## ASP.NET Core health checks

```csharp
builder.Services.AddHealthChecks()
    .AddNpgSql(connectionString, tags: new[] { "ready" })
    .AddRedis(redisConnection, tags: new[] { "ready" });

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false  // всегда healthy — процесс жив
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

## Troubleshooting

| Проблема | Команда | Проверяй |
|----------|---------|----------|
| CrashLoopBackOff | `kubectl logs pod -n ns` | OOM? Probe timing? |
| ImagePullBackOff | `kubectl describe pod` | Image name? Pull secret? |
| Pending | `kubectl describe pod` | Resources? Node capacity? |
| Не получает трафик | `kubectl get endpoints` | Labels match? Readiness? |

```bash
kubectl rollout undo deployment/myapp -n prod   # откатить
kubectl rollout status deployment/myapp -n prod  # статус
kubectl top pods -n prod                         # потребление
```

## Чек-лист

- [ ] requests и limits заданы
- [ ] liveness ≠ readiness endpoints
- [ ] startupProbe для медленного старта
- [ ] runAsNonRoot + drop ALL capabilities
- [ ] maxUnavailable=0 для zero downtime
- [ ] NetworkPolicy ограничивает трафик
- [ ] ResourceQuota на namespace
