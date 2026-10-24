# DPT-11: манифесты Kubernetes для Depot.Api

Нужны манифесты Kubernetes для `Depot.Api` и `depot-worker` в каталоге `deploy/k8s/`.

- Namespace `depot`; образ `registry.example.com/depot/api:1.4.0` (собран по Dockerfile из репозитория). Реестр приватный,
  pull-secret в namespace уже есть: `regcred`.
- Прод: 3 реплики API, выкат без простоя (SLA 99.9), ноды кластера обновляются раз в неделю с drain.
- Снаружи - через Ingress (класс nginx), хост `depot.example.com`, TLS-secret `depot-tls` уже есть.
- Настройки - по `docs/runbook.md`, `depot-worker` - там же.
- Значения для stage - в `docs/stage-values.md`. Оператора секретов в кластере stage нет, ставить его в рамках задачи не
  нужно: манифесты должны применяться как есть (`kubectl apply -f deploy/k8s/`).
