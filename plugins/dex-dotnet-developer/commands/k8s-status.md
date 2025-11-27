---
description: Статус Kubernetes deployments - pods, replicas, health, ресурсы
allowed-tools: Bash, Read, Grep
argument-hint: [namespace или deployment-name]
---

# /k8s-status

Проверка статуса Kubernetes ресурсов.

## Использование

```
/k8s-status                        # Статус всех deployments в default namespace
/k8s-status production             # Конкретный namespace
/k8s-status myapp                  # Конкретный deployment
/k8s-status production myapp       # Deployment в namespace
```

## Процесс

### 1. Проверка подключения

```bash
kubectl cluster-info --request-timeout=5s
kubectl get nodes -o wide
```

### 2. Статус Deployments

```bash
kubectl get deployments -n $NAMESPACE -o wide
```

### 3. Статус Pods

```bash
kubectl get pods -n $NAMESPACE -l app=$APP_NAME -o wide
```

### 4. Ресурсы

```bash
kubectl top pods -n $NAMESPACE
kubectl top nodes
```

### 5. События

```bash
kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' | tail -20
```

### 6. Логи проблемных подов

```bash
# Текущие логи
kubectl logs -n $NAMESPACE -l app=$APP_NAME --tail=50

# Логи предыдущего контейнера (если был restart)
kubectl logs -n $NAMESPACE POD_NAME --previous --tail=50
```

### 7. Health Checks

```bash
# Describe для просмотра probe конфигурации
kubectl describe deployment $DEPLOYMENT -n $NAMESPACE | grep -A 10 "Liveness\|Readiness"
```

## Вывод

```
Kubernetes Status
=================

Cluster: production-cluster
Context: gke_project_zone_cluster
Nodes: 5 (all Ready)

Namespace: production

Deployments:
+---------------+---------+--------+-------+--------------+
| Name          | Ready   | Status | Age   | Image        |
+---------------+---------+--------+-------+--------------+
| myapp         | 3/3     | OK     | 5d    | myapp:1.2.3  |
| myapp-worker  | 2/2     | OK     | 5d    | myapp:1.2.3  |
| redis         | 1/1     | OK     | 30d   | redis:7      |
+---------------+---------+--------+-------+--------------+

Pods (myapp):
+-------------------------+----------+----------+--------+--------+
| Name                    | Status   | Restarts | CPU    | Memory |
+-------------------------+----------+----------+--------+--------+
| myapp-7b9f8c6d5-abc12   | Running  | 0        | 45m    | 256Mi  |
| myapp-7b9f8c6d5-def34   | Running  | 0        | 52m    | 280Mi  |
| myapp-7b9f8c6d5-ghi56   | Running  | 1        | 38m    | 245Mi  |
+-------------------------+----------+----------+--------+--------+

Health Probes:
- Liveness:  All passing (HTTP GET /health/live)
- Readiness: All passing (HTTP GET /health/ready)

HPA Status:
- Current replicas: 3
- Desired replicas: 3
- CPU utilization: 45% (target: 70%)
- Memory utilization: 55% (target: 80%)

Recent Events:
[5m ago]  Pod myapp-7b9f8c6d5-ghi56 restarted (OOMKilled)
[1h ago]  Scaled up deployment myapp from 2 to 3
[2h ago]  Rolling update completed

Warnings:
- Pod ghi56 was OOMKilled - consider increasing memory limit
- CPU approaching 70% threshold on 1 pod

Recommendations:
1. Increase memory limit from 512Mi to 768Mi:
   kubectl set resources deployment/myapp -n production \
     --limits=memory=768Mi

2. Review pod ghi56 logs for memory issues:
   kubectl logs myapp-7b9f8c6d5-ghi56 -n production --previous

3. Consider adding more replicas if load continues
```

## Полезные команды

### Быстрая диагностика

```bash
# Все ресурсы в namespace
kubectl get all -n production

# Describe проблемного пода
kubectl describe pod POD_NAME -n production

# Exec в под
kubectl exec -it POD_NAME -n production -- /bin/sh

# Port-forward для локального доступа
kubectl port-forward svc/myapp 8080:80 -n production
```

### Rollback

```bash
# История rollout
kubectl rollout history deployment/myapp -n production

# Откат к предыдущей версии
kubectl rollout undo deployment/myapp -n production

# Откат к конкретной revision
kubectl rollout undo deployment/myapp -n production --to-revision=2
```

### Scaling

```bash
# Ручное масштабирование
kubectl scale deployment/myapp -n production --replicas=5

# Проверить HPA
kubectl get hpa -n production
kubectl describe hpa myapp-hpa -n production
```

### Secrets и ConfigMaps

```bash
# Список
kubectl get secrets,configmaps -n production

# Просмотр (осторожно с secrets!)
kubectl get configmap myapp-config -n production -o yaml
```
