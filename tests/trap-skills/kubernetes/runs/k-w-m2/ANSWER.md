Я добавил манифесты в `deploy/k8s/` и ничего не коммитил. Проверить их не удалось: `kubectl` и кластера нет, так что `kubectl apply` не запускался.

**Новые файлы:**
- `deploy/k8s/namespace.yaml` — namespace `depot`.
- `deploy/k8s/secret.yaml` — Secret `depot-env` со значениями stage из `docs/stage-values.md`.
- `deploy/k8s/api-deployment.yaml` — Deployment API и PodDisruptionBudget.
- `deploy/k8s/api-service.yaml` — Service ClusterIP, порт 80 на 8080.
- `deploy/k8s/ingress.yaml` — Ingress nginx для `depot.example.com` с TLS `depot-tls`.
- `deploy/k8s/worker-deployment.yaml` — Deployment `depot-worker`.

**Как устроено:**
- **API:** 3 реплики, RollingUpdate с `maxUnavailable: 0` и `maxSurge: 1`, PDB `minAvailable: 2`, чтобы еженедельный drain нод не оставил меньше двух подов. Поды разносятся по нодам через topologySpread.
- **Пробы API:** startupProbe на `/health` с окном 150 с (холодный старт 20–35 с с миграциями), readiness на `/health`, liveness только TCP. `/health` проверяет БД, и при сбое БД liveness по нему перезапускал бы все поды. Перед остановкой пода стоит `preStop sleep 5`.
- **Worker:** `replicas: 1` и `strategy: Recreate`, чтобы при выкате не работали два экземпляра. Образ тот же, запуск через `args: ["--worker"]`.
- **Безопасность и ресурсы:** оба Deployment запускаются под uid 1654, с read-only корневой ФС и `emptyDir` на `/tmp`. Запросы: память 384Mi, CPU 100m у API и 50m у worker; лимиты: 500m CPU и 512Mi памяти.

**Замечания:**
1. **Секреты.** Оператора секретов нет, а `kubectl apply -f deploy/k8s/` должен работать как есть, поэтому `secret.yaml` лежит в git с FAKE-значениями stage. Для прода его нельзя применять как есть: `depot-env` надо создать или заменить вне git до выката, иначе прод пойдёт с адресом `pg-stage.internal` и тестовым ключом. Нужно решение: отдельный каталог или overlay для прода.
2. **Режим `--worker`.** В `src/Depot.Api/Program.cs` его нет: `args` не разбираются, процесс просто поднимает API. Пока это не реализовано, worker будет вести себя как ещё один API без очереди. Нужно проверить, что `--worker` есть в образе 1.4.0.
3. **Worker и drain.** PDB для worker не делал: с одной репликой `minAvailable: 1` заблокировал бы drain ноды. При drain worker коротко остановится и пересоздастся, это ожидаемо. Проб у worker нет, потому что порта и health-маршрута для него в runbook нет.
4. **Миграции.** Каждая реплика применяет миграции при старте, а при выкате стартуют сразу несколько подов, включая worker. Если `Migrator` не защищён advisory lock, возможна гонка. Я не проверял, как он написан.
5. **Версия образа.** Тег `1.4.0` зафиксирован по задаче. Тег и содержимое образа я не проверял, сборки не было.
