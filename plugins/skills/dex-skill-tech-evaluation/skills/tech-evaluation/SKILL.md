---
name: tech-evaluation
description: "Tech evaluation ловушки. Активируется при tech evaluation, tech stack, PoC, proof of concept, operational cost, vendor evaluation, build vs buy, managed, self-hosted, hype-driven, vendor lock-in, deprecation, license, GPL, AGPL, team expertise"
---

# Technology Evaluation Anti-Patterns

## Technology Evaluation

### CV-driven development
Неправильно: "возьмём Kafka потому что это модно"
Правильно: явные критерии выбора — throughput, latency, operational cost, team expertise
Почему: каждая технология = operational burden, Redis Queue часто достаточно вместо Kafka

### Нет PoC перед adoption
Неправильно: принять решение по документации и блог-постам
Правильно: PoC на реальных данных и нагрузке, замерить latency/throughput/resource usage
Почему: benchmarks вендора ≠ ваш workload, разница может быть в 10x

### Игнорирование operational cost
Неправильно: сравнивать только features и performance
Правильно: учитывать — мониторинг, обновления, backup, hiring, on-call burden
Почему: managed PostgreSQL дешевле self-hosted CockroachDB даже если CockroachDB "лучше"

### Vendor lock-in без оценки exit cost
Неправильно: выбрать managed cloud-specific сервис (DynamoDB, BigQuery, Cosmos DB) без оценки migration cost
Правильно: явно зафиксировать — какой % бизнес-логики использует proprietary API (queries, custom indexing, triggers); рассчитать exit cost при необходимости миграции (rewrite этой логики); compromise: использовать через abstraction layer либо принять lock-in осознанно
Почему: миграция с DynamoDB на PostgreSQL через 3 года = переписывание query layer + data migration многотерабайтных datasets; проблема не «можно ли уйти», а «сколько это стоит» — если 6 месяцев работы команды, то соглашение с вендором фактически permanent

### Deprecation risk не учтён
Неправильно: брать молодой проект (v0.x, < 2 лет, < 100 contributors) для critical infrastructure
Правильно: для critical path — мature технологии (≥ 5 лет, активное сообщество, multiple major adopters); для experimental / non-critical — допустимы молодые при наличии fallback strategy; зафиксировать «что если проект deprecated через 2 года»
Почему: технологии регулярно умирают (RethinkDB, CoreOS, Mesos) — миграция критичной системы из-за deprecation = форсированная переделка без бизнес-ценности; trustworthy proxies зрелости — coverage в managed services, наличие alternative implementations

### License traps
Неправильно: использовать open-source без проверки license terms
Правильно: проверить license type — copyleft (GPL, AGPL → требует open-source ваш код при определённых условиях), permissive (MIT, Apache, BSD → почти без ограничений), source-available (BSL, SSPL → запрет коммерческого SaaS, например MongoDB Atlas-clone); ELv2 / SSPL заблокируют интеграцию в вашем SaaS-продукте; commercial license cost масштабируется по нодам/cores
Почему: AGPL в SaaS = ваш код должен быть open-source (GitHub Enterprise / GitLab Enterprise проблема); SSPL запрещает строить managed-сервис на основе MongoDB / Elasticsearch / Redis 7.4+; commercial license per-node для analytics DB (Snowflake, Databricks) = bill scales with usage экспоненциально

### Hidden cost: data egress и cross-AZ transfer
Неправильно: сравнивать compute и storage cost у managed cloud сервисов, игнорируя network
Правильно: учитывать — egress bandwidth (cross-region и cross-AZ), API calls (DynamoDB, S3 — billable per million), transactions per second pricing tiers, replicate / backup multipliers
Почему: cross-region replication 1TB/day = $50-100/day только за egress (это ~$30-40K/year только за один поток); много мелких S3 GET = stronger driver чем storage size; managed databases часто бесплатны в первый месяц, но scale в продакшне обнаруживает 3-5× от ожидаемого bill

### "Best in class" без team expertise
Неправильно: «выбрали Rust для performance / Kafka для scale» без оценки команды
Правильно: factor team expertise в decision; для core stack — технологии, в которых команда уже эффективна; для experiments — допустимо изучать новое; «obvious best choice» технология часто проигрывает «familiar good enough» из-за learning curve и операционных проблем
Почему: на новый стек команда тратит 6-12 месяцев на достижение прежней velocity; продакшн проблемы (debugging, performance tuning, recovery) требуют экспертизы, которой нет — ведут к outages; CV-driven adoption «потому что круто» = технический долг с длинным хвостом
