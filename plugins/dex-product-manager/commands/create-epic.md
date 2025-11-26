---
name: create-epic
description: Создание нового epic в Notion с полным контекстом
---

# Create Epic Command

Эта команда помогает создать properly structured epic в Notion backlog.

## Процесс

Когда пользователь запускает `/create-epic`, выполните следующие шаги:

### 1. Gather Information

Спросите у пользователя (если не указано):

**Required:**
- Title: краткое название epic (например "Mobile App Redesign")
- Description: что включает epic, какую проблему решает
- Business Value: зачем нужен, какой impact

**Optional:**
- Related Initiative/Theme: к какой roadmap инициативе относится
- Target Quarter: когда планируется
- Owner: кто ответственный PM/Lead
- Success Metrics: как измерить успех

### 2. Validate Epic Scope

Проверьте, что epic:
- Достаточно большой (2-4 weeks работы минимум)
- Но не слишком большой (не больше 1 quarter)
- Имеет clear business value
- Может быть разбит на stories
- Aligned с roadmap/strategy

Если epic слишком маленький → предложите сделать story
Если слишком большой → предложите разбить на несколько epics

### 3. Structure Epic Content

Создайте structured описание epic:

```markdown
# [Epic Title]

## Problem Statement
[Описание проблемы, которую решаем]

**User Pain Points:**
- [Что users сейчас испытывают]
- [Почему это проблема]

## Proposed Solution
[High-level описание решения]

**Key Features:**
- Feature 1: [описание]
- Feature 2: [описание]
- Feature 3: [описание]

## Business Value

**Impact:**
- [Какие metrics улучшатся]
- [Ожидаемый эффект с numbers если есть]

**Strategic Alignment:**
- [Как relates к roadmap/OKR]

## Success Metrics

**Primary:**
- [Main metric для измерения успеха]

**Secondary:**
- [Supporting metrics]

**Target:**
- [Конкретные цели, например "Increase Day 7 retention by 15%"]

## User Stories (High-Level)

Этот epic включает:
1. As a [user], I want [feature] so that [benefit]
2. As a [user], I want [feature] so that [benefit]
3. [etc]

[Детальные stories будут созданы во время refinement]

## Design & Technical Notes

**Design Considerations:**
- [UI/UX requirements]
- [Mockups/wireframes links]

**Technical Considerations:**
- [Architecture changes]
- [Dependencies]
- [Risks]

## Dependencies

**Blocks:**
- [Что нужно завершить сначала]

**Blocked By:**
- [Что блокирует этот epic]

## Timeline

**Target Start:** [Quarter/Month]
**Target Completion:** [Quarter/Month]
**Estimated Effort:** [story points или person-weeks]

## Out of Scope

[Явно укажите, что НЕ входит в этот epic]

## Risks

- Risk 1: [описание + mitigation]
- Risk 2: [описание + mitigation]

## Definition of Done

Epic считается completed когда:
- [ ] Все user stories завершены
- [ ] Success metrics достигнуты
- [ ] Documentation updated
- [ ] Deployed to production
- [ ] Stakeholder sign-off

## Related Links

- Roadmap Initiative: [link]
- Design Docs: [link]
- Technical Specs: [link]
- Research/Discovery: [link]
```

### 4. RICE Prioritization

Помогите вычислить RICE score:

```
Reach: Сколько users затронет per quarter?
[Ask user or estimate]

Impact: Value per user (0.5 / 1 / 2 / 3)
- Massive impact = 3
- High = 2
- Medium = 1
- Low = 0.5
[Ask user to choose]

Confidence: Уверенность в estimates (50% / 80% / 100%)
- High = 100%
- Medium = 80%
- Low = 50%
[Ask user to choose]

Effort: Person-months
[Ask team or estimate based on scope]

RICE Score = (Reach × Impact × Confidence) / Effort
[Calculate and show]
```

### 5. Create in Notion

Используйте Notion MCP для создания epic:

**Page Structure:**
- Parent: Backlog или Epics database
- Title: [Epic Title]
- Properties:
  - Type: Epic
  - Status: Backlog (или Ready если refined)
  - Priority: [Based on RICE]
  - RICE Score: [calculated value]
  - Target Quarter: [if specified]
  - Owner: [if specified]
  - Tags: [relevant labels]
- Content: [structured description from step 3]

### 6. Link to Roadmap

Если epic связан с roadmap initiative:
- Найдите соответствующую initiative page в Notion
- Добавьте link от epic к initiative
- Обновите initiative page: add epic в список

### 7. Generate User Stories (Optional)

Предложите создать initial user stories:

```
"I've created the epic. Would you like me to generate initial user stories?"

Если yes:
- Разбейте epic на 5-10 high-level stories
- Создайте stories в Notion
- Link к epic
- Status: Backlog (refinement needed)
```

## Output

После создания epic, предоставьте:

```markdown
✓ Epic Created: [Title]

📋 Details:
- RICE Score: [score] (Priority: [P0/P1/P2/P3])
- Estimated Effort: [effort]
- Target: [quarter]
- Owner: [name]

🔗 Links:
- Epic: [Notion URL]
- Related Initiative: [URL if applicable]

📊 Prioritization:
[Explain где epic стоит в backlog priorities]

✅ Next Steps:
1. Review epic with stakeholders
2. Create detailed user stories during refinement
3. Add to sprint planning when ready
4. [Any other action items]
```

## Examples

### Example 1: Simple Epic

```
User: /create-epic для redesign onboarding flow

Agent: Let me help create that epic. I have some questions:

1. What's the main problem with current onboarding?
2. What's the expected business impact?
3. Do you have a target quarter?

[After gathering info, create epic with full structure]
```

### Example 2: Epic from Initiative

```
User: /create-epic "Payment Integration" от roadmap Q2 initiative

Agent: I found the Q2 initiative "Monetization Launch". Creating epic...

[Searches Notion for initiative, links epic to it, inherits context]
```

## Validation Checklist

Before creating, ensure:
- [ ] Title is clear и concise (3-5 words)
- [ ] Problem statement is specific
- [ ] Business value is articulated
- [ ] Success metrics are defined
- [ ] Scope is appropriate (not too big/small)
- [ ] RICE score calculated
- [ ] Links to relevant docs/initiatives
- [ ] Out of scope explicitly stated
- [ ] Risks identified

## Tips

1. **Start with Why**: всегда с problem statement, не с solution
2. **Be Specific**: avoid vague terms, use concrete examples
3. **Metrics First**: определите success metrics до implementation
4. **User-Centric**: focus на user value, не на technical details
5. **Scope Clarity**: явно state что in scope и out of scope
6. **Collaborative**: involve team в refinement после creation
7. **Living Document**: epic evolves по мере discovery

Помните: epic - это outline, детали появятся в stories во время refinement!
