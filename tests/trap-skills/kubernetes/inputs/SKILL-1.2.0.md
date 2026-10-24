---
name: kubernetes
description: Kubernetes - манифесты Deployment и Service - проверки liveness и readiness, requests и limits, секреты в репозитории. Активируется при kubernetes, k8s, deployment, pod, ingress, helm, kustomize, kubectl, configmap, secret, liveness, readiness, resources
---

# Kubernetes - чек-лист

Пункт называет ситуацию, которую манифест проверяет.

- Liveness и readiness на одной проверке, которая ходит в зависимости (БД, кэш)
- Контейнер без requests и limits
- Значения секретов в манифестах репозитория
