Манифесты записаны в `deploy/k8s/`, ничего не закоммичено. Проверить их нечем: кластера и `kubectl` нет, `kubectl apply` не запускал.

**Новые файлы:**
- `deploy/k8s/00-namespace.yaml` — namespace `depot`.
- `deploy/k8s/api-deployment.yaml` — Deployment API.
- `deploy/k8s/api-service.yaml` — Service API.
- `deploy/k8s/api-pdb.yaml` — PodDisruptionBudget для API.
- `deploy/k8s/api-ingress.yaml` — Ingress.
- `deploy/k8s/worker-deployment.yaml` — Deployment `depot-worker`.
- `deploy/k8s/README.md` — порядок применения и создания секрета.

**Что сделано:**
- **API:**
  - 3 реплики, образ `registry.example.com/depot/api:1.4.0`, pull-secret `regcred`.
  - Выкат идёт с `maxUnavailable: 0` и `maxSurge: 1`.
  - PDB `minAvailable: 2` защищает от еженедельного drain.
  - Поды разносятся по нодам через `topologySpreadConstraints`.
  - Перед остановкой пода `preStop` ждёт 5 секунд.
  - Requests и limits заданы по замерам из runbook: 100m/500m CPU, 384Mi/512Mi памяти.
  - Корневая ФС только для чтения, `/tmp` — отдельный `emptyDir`, запуск под uid 1654 с `drop ALL`.
- **Пробы:**
  - Liveness и startup — `tcpSocket` на порт, в БД они не ходят.
  - Readiness — `GET /health`, который делает `select 1`. Если БД недоступна, под выводится из Service, но не перезапускается.
  - Startup даёт 120 секунд, так как холодный старт с миграциями занимает до 35 с.
- **Ingress:** класс `nginx`, хост `depot.example.com`, TLS-secret `depot-tls`.
- **`depot-worker`:**
  - Образ тот же, `args: ["--worker"]` дописываются к ENTRYPOINT образа.
  - Стоит `replicas: 1` и стратегия `Recreate`, чтобы при выкате не работало два экземпляра.
- **Секреты:** значений в репозитории нет. Поды берут обе переменные из Secret `depot-env` через `secretKeyRef`.

**Замечания к задаче:**
1. **Secret `depot-env` нужно создать вручную до применения.** Иначе поды упадут с `CreateContainerConfigError`. Оператора секретов на stage нет, а класть значения в репозиторий нельзя, поэтому порядок описан в `deploy/k8s/README.md`. Значения для stage берутся из `docs/stage-values.md`. Одним `kubectl apply -f deploy/k8s/` на чистый namespace не обойтись: секрет создаётся отдельной командой.
2. **Для воркера нет проб.** В runbook про его здоровье ничего не сказано, а в `Program.cs` нет обработки `--worker`. Похоже, этот режим не реализован в коде этого репозитория. Если он реализован в образе, нужно уточнить у разработчиков, слушает ли воркер порт и есть ли у него проверка здоровья.
3. **Ресурсы воркера взяты те же, что у API.** Замеров для него нет.
4. **На stage манифесты применяются как есть, поэтому там тоже 3 реплики.** Если для stage нужно меньше, это надо задать отдельно.
5. **Ingress:** отдельных аннотаций nginx (таймауты, размер тела запроса) не добавлял, в задаче их нет.
6. **Лишний коммит в истории.** Коммит `efd23ef "DPT-11: манифесты Kubernetes"` уже есть в истории, но файлов `deploy/` в нём нет.
