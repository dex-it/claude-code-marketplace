---
description: Глубокий security-проход по коду/diff (языко-агностично) — threat model, attack paths, цепочки эксплойтов
allowed-tools: Read, Grep, Glob, Bash, Skill
---

# /security-scan

**Goal:** Провести глубокий security-проход — построить модель угроз, разобрать пути атак, собрать цепочки эксплойтов. Не общий код-ревью.

**Output:** Threat Model (акторы / границы доверия / активы) → Attack Paths (граница → вектор → актив) → Exploit Chains (severity по эксплуатируемости цепочки, evidence, фикс). Формат — как в агенте `security-reviewer`.

## Действия

- Построить threat model: акторы (anon/user/admin/service), границы доверия, активы (данные/секреты/деньги/привилегии)
- Для каждой границы — достижимые OWASP-векторы (access control/IDOR, injection, crypto, auth, SSRF/path traversal, logging) с привязкой «актор → актив»
- Загрузить условно `dex-skill-owasp-security` (всегда) + частные под стек
- Связать находки в цепочки, опровергнуть каждую, severity по эксплуатируемости цепочки

## Notes

- Глубина, не охват: поверхностный паттерн-чек — дело общего ревьюера; этот проход — threat-model
- Только security; correctness/perf — общий ревьюер
- Не править код — выход это findings-цепочки
- Каждая цепочка с путём атаки и evidence (file:line); без достижимого пути не выносить
- Нет маркера accepted risk — находка подсвечивается
