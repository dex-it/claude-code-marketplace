---
name: capacity-planning
description: "Capacity planning ловушки. Активируется при capacity, capacity planning, peak load, write amplification, back-of-envelope, read:write ratio, hot path, cache cost, denormalization, throughput, QPS, RPS, sizing"
---

# Capacity Planning Anti-Patterns

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

## Read:Write Ratio Estimation

### Кеш ставится без проверки ratio и cost asymmetry
Неправильно: «кешируем чтобы быстрее» без оценки read:write и стоимости read vs write
Правильно: cache оправдан при read:write ≥ 10:1 при сопоставимой стоимости read и write; для дорогих read (сложные JOIN'ы, cross-system calls, ML inference, S3 GET) порог снижается до 3-5:1; для дешёвых read (PK lookup в той же БД, in-memory структуры) cache не окупается даже при ratio 100:1
Почему: при 1:1 cache hit-rate ~0%, invalidation overhead ≥ выгоды; при дорогом read и редкой записи cache окупается даже при ratio 3:1 — одна экономия read >> N invalidation'ов; при дешёвом read добавляется сложность (race conditions, stale data) без видимой выгоды

### Ignore background reads при оценке нагрузки
Неправильно: считать только user-facing запросы
Правильно: учитывать analytics-pipelines, replication reads, backup, search-index rebuild — часто 5-10× от user reads
Почему: 80% read load на primary могут быть от ETL ночью, primary не выдержит peak hour user'ов

### Denormalization без обоснования ratio
Неправильно: «нормализуем по 3NF, потому что best practice»
Правильно: денормализация оправдана при read:write > 100:1 на конкретной таблице; для write-heavy (audit log) — наоборот, минимальная денормализация
Почему: денормализация = N мест обновлять при write; при write-heavy это убивает throughput

## Hot Path Identification

### Premature optimization холодного пути
Неправильно: оптимизировать admin-endpoint (10 запросов в день)
Правильно: правило Парето (80/20) — hot 10-20% endpoint'ов (по volume × latency-cost) дают 80-90% эффекта оптимизации; их и оптимизировать в первую очередь
Почему: ускорение admin с 1s до 100ms = 9s выгоды в день; ускорение feed-load с 200ms до 100ms при 1M RPS = тысячи compute-часов и заметное снижение p95 latency для всех users

### Feature без анализа hot path scope
Неправильно: новая фича сразу в hot path (например, ML-recommendation внутри feed-load)
Правильно: вынести heavy computation в async (precompute → cache → serve); hot path только assembly из готовых данных
Почему: добавление 50ms ML-call в feed-load с 100ms latency = 50% degradation для всего трафика; precompute раз в час с cache hit делает добавку «бесплатной»
