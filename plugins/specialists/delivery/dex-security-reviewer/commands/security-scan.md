---
description: Выделенный security-проход по коду/diff (языко-агностично) — категории OWASP, частные skills под стек
allowed-tools: Read, Grep, Glob, Bash, Skill
---

# /security-scan

**Goal:** Провести отдельный security-проход по коду или diff — только безопасность, по категориям OWASP, с фальсификацией находок.

**Output:** Карта поверхности атаки → Pass 1 (прямой проход по категориям) → Pass 2 (skills под стек) → Findings (severity, вектор, evidence, фикс). Формат — как в агенте `security-reviewer`.

## Действия

- Определить стек и поверхность атаки: входы, границы доступа (owner/tenant), недоверенный ввод
- Пройти категории: access control/IDOR, injection, crypto, auth, SSRF/path traversal, logging
- Загрузить условно `dex-skill-owasp-security` (всегда) + частные под стек
- Опровергнуть каждую находку, проставить severity по эксплуатируемости

## Notes

- Только security; correctness/perf — общий ревьюер
- Не править код — выход это findings
- Каждая находка с вектором атаки и evidence (file:line); без пути атаки не выносить
- Нет маркера accepted risk — находка подсвечивается
