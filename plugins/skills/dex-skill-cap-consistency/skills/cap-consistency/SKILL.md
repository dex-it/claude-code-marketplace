---
name: cap-consistency
description: "CAP / consistency ловушки: strong vs eventual, PACELC. Активируется при CAP, CAP theorem, PACELC, consistency, strong consistency, eventual consistency, distributed transaction, 2PC, saga, outbox, ACID, BASE, linearizability"
---

# CAP / Consistency Anti-Patterns

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

### Read-your-writes consistency не зафиксирована
Неправильно: после write на primary читать с reader replica с async replication
Правильно: либо routing «read-your-writes от primary в течение N секунд после write», либо session-stickiness к primary, либо synchronous replication для критичных потоков (user видит свой commit)
Почему: user создал post → list постов с реплики → пост отсутствует (replication lag 100-500ms) → user думает что система потеряла данные → дублирует action; для UI-флоу read-your-writes — must-have UX requirement, не technical detail

### Quorum reads/writes без понимания что они дают
Неправильно: «выставили R=W=N для consistency и забыли»
Правильно: правило R+W>N даёт strong consistency only when nodes available; при partition квoring fails; latency = max(R slowest replicas), throughput = N / (R+W) от single-node; explicit coordination override (Cassandra LOCAL_QUORUM vs EACH_QUORUM) для multi-DC
Почему: R+W>N решает «видим ли мы последний commit» только в normal case; при partition один из reads/writes fails — система падает в availability ради promised consistency; неправильный quorum для multi-DC = либо потеря consistency между регионами, либо latency × N

### Split-brain не учтён в CP-системах
Неправильно: «у нас CP, partition безопасен»
Правильно: CP-система при partition ОТКАЗЫВАЕТ в обслуживании minority partition (не записывает); явная стратегия — fencing tokens (epoch number в каждом write), STONITH (shoot the other node in the head), leader lease с auto-expiry; majority-partition продолжает работать, minority отвечает 503
Почему: без fencing старый leader minority-partition продолжает писать → когда partition закроется, два конфликтующих state → split-brain merge нерешим автоматически; CP без явной стратегии fencing = на самом деле AP с проблемами

### Clock skew как distributed system problem
Неправильно: использовать `NOW()` из локального clock'а для ordering events / TTL / locks
Правильно: для ordering — logical clocks (Lamport timestamps, vector clocks) либо hybrid (HLC); для TTL — lease с server-side проверкой; для distributed locks — fencing tokens вместо timestamp; NTP sync с monitoring drift, allowed skew зафиксирован в design
Почему: NTP daje ±50-500ms drift между нодами; lock с TTL по local clock = два holder'а одновременно (clock на ноде B отстал → она думает что lock ещё валиден); event ordering через timestamp = причинно-следственные связи нарушаются (B видит «причину» позже «следствия»)

### Saga без compensation для всех шагов
Неправильно: спроектировать saga для happy path, считать что rollback не понадобится
Правильно: для каждого шага saga должна быть compensating action; compensation должна быть idempotent; учитывать неотменяемые действия (отправка email, реальный платёж) — для них либо переставить порядок шагов (неотменяемое последним), либо явная политика «компенсируем что можем»
Почему: saga без compensation на step N = при failure после step N система в неконсистентном state без auto-recovery (нужен manual ops); неотменяемые действия посередине saga = логически невозможный rollback; не-idempotent compensation = двойной rollback при retry падает
