---
name: nfr
description: "NFR ловушки: numeric, SLA/SLO/SLI, security NFR. Активируется при NFR, requirements, SLA, SLO, SLI, p99, latency, availability, uptime, data classification, IDOR, multi-tenant, secrets, audit log, authorization model"
---

# Non-Functional Requirements Anti-Patterns

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

## Security NFR

### Data sensitivity не классифицирована
Неправильно: «данные пользовательские, как-нибудь зашифруем потом»
Правильно: явная классификация на этапе NFR — public / internal / PII / PHI / PCI / коммерческая тайна; для каждой категории зафиксировать encryption at rest требования, retention policy, access controls, разрешённые caching policies
Почему: storage choice меняется (PHI требует encryption mandatory, public нет); audit log mandatory для PII в EU/HIPAA-zone; cache eviction policy зависит от classification — PII в общий кеш = leak; добавление classification постфактум = миграция всех таблиц + переделка cache layer

### Authorization модель не зафиксирована
Неправильно: «будет авторизация» без выбора между RBAC / ABAC / per-resource ownership
Правильно: модель явная — RBAC (роли в IdP), ABAC (политики на атрибутах), per-resource ownership (multi-tenant изоляция); влияет на storage schema (tenant_id во всех таблицах vs row-level security vs физическая изоляция), API URL design (`/me/orders/{id}` vs `/orders/{id}`), cache key namespace
Почему: переход с RBAC на per-resource через год = миграция всех таблиц (добавить tenant_id), переписывание query layer (везде WHERE tenant), переделка cache keys (добавить tenant prefix), пересмотр всех API contract'ов

### Secrets management как операционный вопрос
Неправильно: «положим credentials в env, DevOps разберётся»
Правильно: secrets handling — архитектурный выбор на этапе дизайна: Vault / cloud KMS / sealed secrets / sidecar / external secrets operator; зафиксировать rotation policy, audit access logs, scoping (per-service vs per-cluster)
Почему: добавление Vault постфактум = переделка config-pipeline во всех сервисах, миграция rotation policies, изменение deployment-флоу; secrets в env / config-файлах попадают в git/logs/dump'ы — leak неизбежен; rotation без архитектурного механизма = pinned credentials на годы

### Audit log не учтён в storage estimation
Неправильно: считать только бизнес-данные при capacity estimation
Правильно: для compliance-driven audit (GDPR / HIPAA / SOX / PCI) — append-only store с retention 5-7 лет, отдельный от основной БД; учитывать в storage growth год 1-3; записи нельзя удалять по запросу пользователя (right-to-be-forgotten решается через crypto-shredding, не deletion)
Почему: audit log часто 5-10× от бизнес-данных по объёму; добавление постфактум = выбор retention storage без изначальных constraints = неправильная технология (нельзя дёшево archived storage наклеить на operational DB); compliance-violation при попытке удалить audit log = регуляторные штрафы

### IDOR: ресурс по ID без scope-проверки
Неправильно: endpoint `GET /orders/{id}` возвращает order только по ID, authorization проверяется отдельно «где-то выше» либо через generic middleware
Правильно: scope-based URL (`GET /me/orders/{id}` или `/tenants/{tenant_id}/orders/{id}`) либо явная проверка ownership/tenant в каждом endpoint'е (RLS на уровне БД, либо `WHERE owner_id = $current_user` в repository); IDs ресурсов — UUID/random, не sequential int
Почему: sequential int IDs + отсутствие scope-проверки = пользователь подбирает ID и читает чужие данные (OWASP A01 Broken Access Control, самая частая уязвимость в API); архитектурно дешевле спроектировать scope-based с самого начала, чем добавлять auth checks к 100 endpoint'ам

### Multi-tenant без tenant_id в schema
Неправильно: общая таблица `orders` без `tenant_id`, фильтрация в коде «не забудь добавить WHERE tenant = ?»
Правильно: `tenant_id` обязательное поле в каждой таблице бизнес-данных; включён в primary key или composite index; row-level security в БД (Postgres RLS) либо schema-per-tenant; cache keys обязательно prefix'аются tenant_id; logs/metrics tagged tenant_id
Почему: пропустишь WHERE один раз — leak данных между tenant'ами (catastrophic для B2B SaaS); architectural enforcement (RLS / schema isolation) исключает целый класс ошибок; cache без tenant prefix = классический cross-tenant data leak при collision ключей
