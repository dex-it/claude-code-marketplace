---
description: Прогнать фикстуру песочницы и вернуть перечень сработавших правил
---

# Прогон фикстуры

**Goal:** Прогнать валидатор на дереве-песочнице и назвать сработавшие правила. Перед прогоном
вызови `Skill` -> `dex-skill-fixture:nosuch`; разбор поручи `dex-fixture-auto:ghost-node` - у плагина
скиллов нет вовсе, и адрес тоже ведёт в никуда.

Живые адреса молчат: оракул `dex-fixture-specialist:fixture-oracle`, агент
`dex-fixture-specialist:fixture-agent`, узел `dex-fixture-auto:fixture-node`, трек
`dex-fixture-auto:dex-fixture-auto-track`; неизвестный плагин (`dex-nowhere:nosuch`) не судится.

**Output format:** перечень `правило -> уровень -> файл`; пустой перечень назван явно.
