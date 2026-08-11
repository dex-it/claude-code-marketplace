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
Правильно: модель названа явно — RBAC (роли в IdP), ABAC (политики на атрибутах), per-resource ownership (изоляция арендаторов) — вместе с тем, кто и по какому признаку получает доступ к ресурсу
Почему: модель доступа пронизывает хранение, контракты и кеш; переход с RBAC на per-resource через год = миграция всех таблиц, переписывание слоя запросов, переделка ключей кеша, пересмотр всех API contract'ов

### Обращение с секретами оставлено на потом
Неправильно: «положим credentials в env, DevOps разберётся» — требования к секретам не сформулированы вовсе
Правильно: NFR фиксирует проверяемое обязательство — период ротации, область действия ключа (per-service vs per-cluster), обязательность журнала доступа, запрет попадания секрета в логи и дампы; выбор механизма (Vault / cloud KMS / sealed secrets / sidecar) — решение дизайна под это обязательство, не само требование
Почему: без обязательства дизайн не с чем сверять, и ротация оседает в «когда-нибудь» — pinned credentials на годы; названный в требовании механизм закрывает дизайн-пространство до дизайна и меняется при первом же переезде, хотя нужда не менялась

### Audit log не учтён в storage estimation
Неправильно: считать только бизнес-данные при capacity estimation
Правильно: для compliance-driven audit (GDPR / HIPAA / SOX / PCI) — append-only store с retention 5-7 лет, отдельный от основной БД; учитывать в storage growth год 1-3; записи нельзя удалять по запросу пользователя (right-to-be-forgotten решается через crypto-shredding, не deletion)
Почему: audit log часто 5-10× от бизнес-данных по объёму; добавление постфактум = выбор retention storage без изначальных constraints = неправильная технология (нельзя дёшево archived storage наклеить на operational DB); compliance-violation при попытке удалить audit log = регуляторные штрафы

> Как эти обязательства ломаются в коде — обход проверки владельца, IDOR, multi-tenancy, добавленная в сущность задним числом, секреты в репозитории — `dex-skill-owasp-security`. Здесь только формулировка меры: что обязательно и чем это проверяется.
