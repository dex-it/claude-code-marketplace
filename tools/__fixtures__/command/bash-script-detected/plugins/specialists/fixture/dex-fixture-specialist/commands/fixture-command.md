---
description: Прогнать фикстуру песочницы и вернуть перечень сработавших правил
---

# Прогон фикстуры

**Goal:** Прогнать валидатор на дереве-песочнице и назвать сработавшие правила.

**Output format:** перечень `правило -> уровень -> файл`; пустой перечень назван явно.

```bash
cp -r base sandbox
cp -r overlay sandbox
node tools/validate-agent.js all
echo done
```

```bash
cp -r base sandbox
cp -r overlay sandbox
node tools/validate-agent.js all
echo done
```

```bash
cp -r base sandbox
cp -r overlay sandbox
node tools/validate-agent.js all
echo done
```
