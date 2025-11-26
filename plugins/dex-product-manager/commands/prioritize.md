---
name: prioritize
description: Приоритизация backlog items с использованием RICE framework
---

# Prioritize Command

Эта команда запускает систематическую приоритизацию backlog items.

## Процесс

### 1. Determine Scope

Спросите пользователя, что приоритизировать:

**Options:**
- Весь backlog
- Specific epic
- New items только (без существующих priorities)
- Top N items для review
- Items с определённым tag/filter

**Default**: items без priority или с outdated priorities (>1 month)

### 2. Fetch Items from Notion

Используйте Notion MCP:

```
Получите:
- Title
- Description
- Current Priority (если есть)
- Current RICE Score (если есть)
- Type (Epic / Story / Bug / Task)
- Tags / Labels
- Assignee
- Status
```

Отфильтруйте items для prioritization:
- Status: Backlog, Ready (не In Progress или Done)
- Not already prioritized (или re-prioritization requested)

### 3. Apply Prioritization Framework

По умолчанию используйте **RICE Scoring**.

Для каждого item:

#### Calculate RICE Score

**Reach (R)**
```
Сколько users/customers затронет per quarter?

Ask или estimate:
- Все users: 10
- Большинство (>50%): 5
- Заметная часть (10-50%): 3
- Небольшая часть (<10%): 1
- Internal only: 0.5
```

**Impact (I)**
```
Насколько сильно повлияет на каждого user?

Scale:
- Massive (game-changer): 3
- High (значительное улучшение): 2
- Medium (заметное улучшение): 1
- Low (небольшое улучшение): 0.5
- Minimal: 0.25
```

**Confidence (C)**
```
Насколько уверены в оценках reach/impact/effort?

Percentage:
- High confidence (есть data): 100%
- Medium (есть assumptions): 80%
- Low (много unknowns): 50%
```

**Effort (E)**
```
Сколько work требуется?

Person-months:
- Few hours: 0.1
- Few days: 0.25
- 1 week: 0.5
- 2 weeks: 1
- 1 month: 2
- Quarter: 6
- Half year: 12

Или используйте existing estimates:
- Story points: 1 point ≈ 0.1 person-month
- T-shirt sizes: XS=0.25, S=0.5, M=1, L=2, XL=4
```

#### Calculate Score

```
RICE Score = (Reach × Impact × Confidence) / Effort

Example:
Reach: 5 (50% users)
Impact: 2 (high value)
Confidence: 80%
Effort: 1 (2 weeks)

RICE = (5 × 2 × 0.8) / 1 = 8.0
```

### 4. Assign Priority Tiers

После scoring всех items, отсортируйте по RICE score и распределите по tiers:

```
P0 (Critical): RICE > 20 или strategic must-haves
- Top 10-15% of items
- Критичные для business
- Immediate action required

P1 (High): RICE 10-20
- Next 20-30% of items
- Important, should do soon
- Schedule in next 1-2 sprints

P2 (Medium): RICE 5-10
- Middle 30-40% of items
- Valuable but can wait
- Schedule in next quarter

P3 (Low): RICE < 5
- Bottom 20-30% of items
- Nice to have
- Backlog for later
```

### 5. Adjust for Strategic Priorities

RICE score - это начало, но нужны adjustments:

**Consider:**
- **Strategic Alignment**: roadmap commitments, OKR alignment
- **Dependencies**: blockers для других high-priority items
- **Technical Debt**: critical tech debt может быть P0 даже с low RICE
- **Quick Wins**: low effort + medium impact = good momentum
- **Risks**: high-risk items могут нужны earlier для validation
- **Customer Commitments**: обещания customers/stakeholders
- **Time Sensitivity**: limited-time opportunities

**Adjustment Process:**
```
1. Review top 20 items по RICE
2. Для каждого ask:
   - Strategic fit? (roadmap/OKR)
   - Dependencies? (blocks/blocked by)
   - Urgency? (time-sensitive)
   - Risk? (need validation)
3. Adjust priority tier если нужно
4. Document reasoning в notes
```

### 6. Balance Backlog Mix

Проверьте distribution по types:

```
Healthy Balance:
- Features: 60-70%
- Bugs: 15-20%
- Tech Debt: 10-15%
- Research/Spikes: 5-10%

Priority Distribution:
- P0: 10-15%
- P1: 20-30%
- P2: 30-40%
- P3: 20-30%
```

Если imbalance:
- Слишком много P0 → что-то wrong с prioritization
- Нет tech debt в top priorities → будут проблемы later
- Все bugs P3 → product quality страдает

### 7. Update Notion

Для каждого prioritized item, обновите в Notion:

```
Properties to Update:
- Priority: P0 / P1 / P2 / P3
- RICE Score: [calculated value]
- RICE Breakdown: R=[X] I=[X] C=[X] E=[X]
- Priority Notes: [reasoning for adjustments]
- Last Prioritized: [today's date]
```

### 8. Create Prioritization Report

Сгенерируйте summary report:

```markdown
# Backlog Prioritization Report
Date: [today]
Scope: [what was prioritized]
Framework: RICE

## Summary
- Total Items Reviewed: [N]
- Items Updated: [N]
- Average RICE Score: [X]

## Priority Distribution
- P0 (Critical): [N items] ([X%])
- P1 (High): [N items] ([X%])
- P2 (Medium): [N items] ([X%])
- P3 (Low): [N items] ([X%])

## Type Distribution
- Features: [N] ([X%])
- Bugs: [N] ([X%])
- Tech Debt: [N] ([X%])
- Other: [N] ([X%])

## Top 10 Priorities

| Rank | Title | Type | RICE | Priority | Reasoning |
|------|-------|------|------|----------|-----------|
| 1    | [Title] | Story | 25.6 | P0 | [Strategic + high impact] |
| 2    | [Title] | Bug | 18.2 | P0 | [Critical customer issue] |
| ...  | ...   | ...  | ...  | ...  | ... |

## Key Changes
- [Item X] moved to P0: [reason]
- [Item Y] moved to P2: [reason]
- [Item Z] removed from backlog: [reason]

## Observations
- [Insights from prioritization]
- [Patterns noticed]
- [Concerns raised]

## Recommendations
1. [Action item]
2. [Action item]
3. [Action item]

## Next Steps
- Review with team on [date]
- Update roadmap based on priorities
- Schedule P0 items in next sprint

---
Full details: [Link to Notion backlog view sorted by priority]
```

### 9. Follow-up Actions

Предложите next steps:

```
1. "Schedule sprint planning to assign top P0/P1 items"
2. "Update roadmap based on new priorities"
3. "Notify stakeholders about priority changes"
4. "Create tasks for items that need more refinement"
5. "Archive or delete P3 items older than 6 months"
```

## Alternative Frameworks

Если пользователь предпочитает другой framework:

### MoSCoW

```
Must Have: критично, без этого release невозможен
Should Have: важно, но release может без этого
Could Have: nice to have, если time позволит
Won't Have: не в этом release, возможно позже

Процесс:
1. Группируйте items по categories
2. Must Have должно быть ~60% capacity
3. Should Have ~20%
4. Could Have ~20%
```

### ICE Score

```
ICE = (Impact + Confidence + Ease) / 3

Каждый parameter: 1-10 scale
- Impact: value для users
- Confidence: certainty в оценках
- Ease: простота implementation (10 = very easy)

Быстрее чем RICE, но менее precise
```

### Value vs Effort Matrix

```
2x2 Matrix:
- High Value, Low Effort → Do First (Quick Wins)
- High Value, High Effort → Plan Carefully (Big Bets)
- Low Value, Low Effort → Do Later (Fill-ins)
- Low Value, High Effort → Avoid (Money Pit)

Visual prioritization, good для workshops
```

### Kano Model

```
Categories:
- Must-be: expected, absence causes dissatisfaction
- Performance: more = better (proportional satisfaction)
- Attractive: delighters, unexpected positive
- Indifferent: users don't care
- Reverse: some like, some dislike

Use для understanding satisfaction impact
```

## Tips for Effective Prioritization

1. **Regular Cadence**: приоритизируйте каждые 2-4 недели
2. **Team Input**: involve developers для effort estimates
3. **Customer Feedback**: данные от support, sales, users
4. **Be Ruthless**: если сомневаетесь, это probably not P0
5. **Limit P0**: если всё critical, ничто не critical
6. **Document Reasoning**: запишите "почему", не только "что"
7. **Review & Adjust**: priorities меняются, это ok
8. **Communicate**: tell team почему такие priorities
9. **Balance**: features + bugs + tech debt + innovation
10. **Bias to Action**: better to prioritize imperfectly than not prioritize

## Common Pitfalls

**HIPPO (Highest Paid Person's Opinion)**
- Решение: use data и frameworks, не мнения
- Вовлекайте stakeholders но объясняйте scoring

**Shiny Object Syndrome**
- Решение: новое ≠ important, apply same framework
- Link к strategic goals

**Tech Debt Neglect**
- Решение: explicit % capacity на tech debt (10-15%)
- Score tech debt также как features

**Analysis Paralysis**
- Решение: time-box prioritization sessions
- Perfect prioritization невозможна, good enough лучше чем none

**Ignoring Dependencies**
- Решение: check blocked/blocks перед finalization
- Adjust priorities accordingly

## Output Format

После prioritization, пользователь получает:

1. **Updated Notion Backlog**: все items с новыми priorities
2. **Prioritization Report**: markdown document с summary
3. **Top 10 List**: ready для sprint planning
4. **Action Items**: follow-up tasks
5. **Notion Link**: link на sorted backlog view

Помните: prioritization - это continuous process, не one-time activity. Re-prioritize регулярно!
