---
name: system-design
description: "System design anti-patterns — ловушки NFR, capacity planning, масштабирования. Активируется при system design, нефункциональные требования, NFR, capacity planning, scalability, CAP theorem, availability, throughput, latency, SLA, SLO, SLI, horizontal scaling, vertical scaling, load balancing, ATAM, trade-off analysis, architecture review, technology radar"
---

# System Design Anti-Patterns

## NFR Traps

### NFR без конкретных чисел
Неправильно: "система должна быть быстрой и масштабируемой"
Правильно: "p95 latency < 200ms при 1000 RPS, горизонтальное масштабирование до 10 нод"
Почему: без чисел невозможно валидировать архитектуру и выбрать технологии

### SLA без SLO и SLI
Неправильно: "SLA 99.9%" без определения что именно измеряется
Правильно: SLI (метрика: % успешных запросов) → SLO (цель: 99.9%) → SLA (контракт с penalties)
Почему: SLA без SLO — пустое обещание, нельзя мониторить и алертить

### Availability vs Uptime
Неправильно: путать availability (доля успешных запросов) и uptime (время работы сервера)
Правильно: availability = successful requests / total requests за период
Почему: сервер может быть up, но отдавать 500. Uptime 99.99% ≠ availability 99.99%

### Игнорирование p99 latency
Неправильно: ориентироваться на average latency (50ms)
Правильно: смотреть p95/p99 — часто в 10-50x от average
Почему: average скрывает tail latency, который бьёт по UX real users

## Capacity Planning

### Planning по average load
Неправильно: "средняя нагрузка 100 RPS, нужен сервер на 100 RPS"
Правильно: планировать на peak × safety margin (обычно 3-5x от average)
Почему: peak может быть 10x от average (чёрная пятница, утренний час-пик)

### Игнорирование write amplification
Неправильно: считать только user-facing запросы
Правильно: 1 API call = N DB queries + M cache ops + K message publishes
Почему: внутренний трафик часто 10-100x от внешнего, узкое место — не API

### Нет back-of-envelope estimation
Неправильно: "потом оптимизируем если надо"
Правильно: прикинуть на салфетке — 1M users × 10 requests/day × 5KB = 50GB/day
Почему: позволяет отсечь нереалистичные решения на старте (SQLite для 10TB)

## Scalability Anti-Patterns

### Premature horizontal scaling
Неправильно: сразу проектировать distributed систему на 3 пользователя
Правильно: начать с vertical scaling, horizontal — когда vertical исчерпан
Почему: distributed = сложность (consensus, network partitions, eventual consistency)

### Stateful services
Неправильно: хранить сессии/кэш в памяти процесса
Правильно: externalize state (Redis, DB), сделать сервисы stateless
Почему: stateful сервис нельзя горизонтально масштабировать без sticky sessions

### Shared mutable state между сервисами
Неправильно: два сервиса пишут в одну таблицу БД
Правильно: каждый сервис владеет своими данными, общение через API/события
Почему: shared DB = скрытая связность, невозможно независимо масштабировать и деплоить

## CAP / Consistency

### Strong consistency когда достаточно eventual
Неправильно: ACID транзакции между микросервисами (distributed transactions, 2PC)
Правильно: eventual consistency + saga/outbox для большинства бизнес-процессов
Почему: 2PC = single point of failure + latency, допустим только для financial-grade операций

### Игнорирование PACELC
Неправильно: "мы выбрали AP по CAP, значит consistency не важна"
Правильно: PACELC — даже без partition есть trade-off latency vs consistency
Почему: CAP — про failure mode, PACELC — про normal operation, оба важны

### CAP как binary choice
Неправильно: "наша система CP" или "наша система AP"
Правильно: разные части системы могут иметь разные guarantees (payments = CP, recommendations = AP)
Почему: CAP — per-operation, а не per-system решение

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
