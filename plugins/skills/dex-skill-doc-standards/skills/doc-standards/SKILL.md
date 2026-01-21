---
name: doc-standards
description: Documentation standards and templates for all document types. Activate for BRD, PRD, ADR, user stories, technical specs, API specs, process docs, requirements, meeting notes, research findings. Keywords - documentation, document, docs, spec, specification, template.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, AskUserQuestion
---

# Documentation Standards

Unified documentation skill for all roles: PM, SA, developers, architects. Provides templates, standards, and best practices for all document types.

## Supported Platforms

Wiki (Confluence, MediaWiki), Cloud (Notion, GitBook), Static (MkDocs, Docusaurus), Markdown in Git.

Skill automatically adapts to available system.

## Core Principles

### 1. Search-First

**Before creating a document:**
1. Search by title (exact + fuzzy)
2. Search by tags/metadata
3. Check hierarchy (parent documents)
4. Use platform search API (if available)

**Found similar (>70% overlap)?**
- Update existing document
- Create child document
- Merge documents
- Unsure - ask user

**Important:** Do NOT read all document contents. Rely on metadata (title, tags, path).

### 2. Hierarchy

```
Documentation Root
|-- Product Documentation (PM)
|   |-- Strategy & Vision
|   |-- Requirements (BRD/PRD)
|   |-- Decisions (ADRs)
|   |-- Research & Discovery
|   +-- Notes & Ideas
|
+-- Technical Documentation (SA/Dev)
    |-- User Stories (from Epics)
    |-- Technical Specifications
    |-- API Documentation
    |-- Process Documentation (BPMN)
    +-- Test Cases
```

**Principles:** Parent-child relationships, breadcrumbs, max 3-4 levels deep.

### 3. Cross-References

**Detection:** Explicit mentions ("see BRD: X", "per ADR-005"), metadata frontmatter (related: [adr-005]).

**Do NOT:** Full-text analyze all documents.

**Link Types:**
- BRD -> ADR (decisions supporting requirements)
- Requirements -> Research (evidence)
- ADR -> ADR (supersedes)
- Story -> Epic (parent)
- Story -> TechSpec (implementation details)
- TechSpec -> API (contracts)
- TestCase -> Story (verification)

### 4. Decomposition

**Split when:** >500 lines, >5 H2 sections, different audiences, independent update cycles.

**Strategies:**
- By audience (exec/PM/dev/QA)
- By component (frontend/backend/db)
- By content type (requirements/design/tests)
- By time (phases/releases)

**Rule:** Main document = hub with links to sub-documents.

### 5. Metadata

```yaml
---
title: Document Title
type: brd | prd | adr | research | notes | user-story | tech-spec | api-spec | process | test-case
status: draft | review | approved | active | done | archived
owner: Name
created: 2025-01-15
updated: 2025-01-20
tags: [category, priority, component]
related:
  - type: document-id
---
```

---

## Product Documentation Templates (PM)

### BRD (Business Requirements Document)

```yaml
---
title: BRD: {NAME}
type: brd
status: draft
owner: PM Name
---
```

**Sections:**
1. Executive Summary (1-2 paragraphs)
2. Business Context (problem, opportunity)
3. Stakeholders (table: role, name, interest)
4. Business Objectives (measurable goals)
5. Functional Requirements (high-level features)
6. Non-Functional Requirements (performance, security, compliance)
7. Success Criteria (KPIs, metrics)
8. Risks and Mitigations
9. Dependencies
10. Timeline and Milestones

### PRD (Product Requirements Document)

```yaml
---
title: PRD: {NAME}
type: prd
status: draft
owner: PM Name
---
```

**Sections:**
1. Overview (what and why)
2. Goals & Objectives (SMART goals)
3. User Personas (who benefits)
4. Use Cases (user journeys)
5. Requirements
   - Functional (features)
   - Non-Functional (quality attributes)
6. Out of Scope (explicitly excluded)
7. Dependencies (technical, organizational)
8. Open Questions
9. Release Criteria

### ADR (Architecture Decision Record)

```yaml
---
title: ADR-{N}: {TITLE}
type: adr
status: proposed | accepted | deprecated | superseded
owner: Architect Name
---
```

**Sections:**
1. Context (situation requiring decision)
2. Decision (what we decided)
3. Consequences
   - Positive
   - Negative
4. Alternatives Considered
5. References (links, research)

### Research Findings

```yaml
---
title: Research: {TOPIC}
type: research
---
```

**Sections:**
1. Objective (research question)
2. Methodology (how we researched)
3. Key Findings (numbered list)
4. User Quotes (verbatim)
5. Recommendations
6. Next Steps

### Meeting Notes

```yaml
---
title: Meeting: {TOPIC} - {DATE}
type: notes
attendees: [name1, name2]
---
```

**Sections:**
1. Agenda
2. Discussion Points
3. Decisions Made
4. Action Items (who, what, when)
5. Parking Lot (deferred topics)
6. Next Meeting

---

## Technical Documentation Templates (SA/Dev)

### User Story

```yaml
---
title: "US-{N}: {NAME}"
type: user-story
epic: Epic Name
priority: must-have | should-have | could-have
story-points: 1-13
status: draft | ready | in-progress | done
---
```

**Format:**
```
As a [type of user]
I want [goal/desire]
So that [benefit/value]

## Acceptance Criteria

### Scenario 1: {Name}
Given [context/precondition]
When [action/event]
Then [expected outcome]
And [additional outcomes]

### Scenario 2: {Name}
Given ...
When ...
Then ...

## Technical Notes
- Implementation hints
- Constraints
- Dependencies

## Definition of Done
- [ ] Criteria from team DoD
```

### Technical Specification

```yaml
---
title: "Tech Spec: {NAME}"
type: tech-spec
status: draft | review | approved
owner: Tech Lead
---
```

**Sections:**
1. Overview (what this spec covers)
2. Architecture
   - System context diagram
   - Component diagram
3. Components (detailed design)
4. Data Model
   - Entities
   - Relationships
   - Schema changes
5. API Contracts (endpoints used/created)
6. Security Considerations
7. Error Handling
8. Performance Requirements
9. Testing Strategy
10. Rollout Plan

### API Specification

```yaml
---
title: "API: {METHOD} {ENDPOINT}"
type: api-spec
version: 1.0.0
---
```

**Sections:**
```
## Endpoint
`{METHOD} /api/v1/{resource}`

## Authentication
Bearer token required | API key | None

## Request

### Headers
| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Yes | Bearer {token} |

### Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | Resource ID |

### Body
\`\`\`json
{
  "field": "value"
}
\`\`\`

## Response

### Success (200)
\`\`\`json
{
  "data": { ... }
}
\`\`\`

### Error Responses
| Code | Description |
|------|-------------|
| 400 | Invalid request |
| 401 | Unauthorized |
| 404 | Not found |
| 500 | Server error |

## Examples

### Request
\`\`\`bash
curl -X POST /api/v1/resource \
  -H "Authorization: Bearer token" \
  -d '{"field": "value"}'
\`\`\`

### Response
\`\`\`json
{
  "data": { "id": "123" }
}
\`\`\`
```

### Process Documentation (BPMN)

```yaml
---
title: "Process: {NAME}"
type: process
---
```

**Sections:**
1. Overview (process purpose)
2. Actors (who participates)
3. Trigger (what starts the process)
4. Flow
   - Steps (numbered)
   - Decision points (gateways)
   - Parallel activities
5. Business Rules
6. Exception Handling
7. BPMN Diagram (Mermaid or image)
8. SLA/Metrics

### Test Case

```yaml
---
title: "TC-{N}: {NAME}"
type: test-case
user-story: US-123
priority: high | medium | low
---
```

**Sections:**
1. Objective (what we're testing)
2. Preconditions (setup required)
3. Test Steps
   | Step | Action | Expected Result |
4. Postconditions (cleanup)
5. Test Data
6. Actual Results (filled during execution)
7. Status: Pass | Fail | Blocked

---

## Formatting Standards

### Document Structure

```yaml
---
metadata (frontmatter)
---

# Title (H1 - one per document)

**Summary:** One sentence description
**Owner:** Name
**Status:** Current status

## Main Sections (H2)

### Subsections (H3)

#### Details (H4 - use sparingly)

## Related Documents
## References
## Changelog
```

### Elements

| Element | Syntax | Use for |
|---------|--------|---------|
| Inline code | \`variable\` | Code, commands, values |
| Code block | \`\`\`lang ... \`\`\` | Multi-line code |
| Table | \| col \| col \| | Structured data |
| Callout | > **Note:** text | Important info |
| Task | - [ ] item | Checklists |

### Priority Labels

- **P0 / Must Have**: Critical, blocks release
- **P1 / Should Have**: Important, workarounds exist
- **P2 / Could Have**: Nice to have
- **P3 / Won't Have**: Out of scope

---

## Duplication Management

```
Creating "{TITLE}":
|-- Search similar (title/tags/path)
|-- Found?
|   |-- Update existing
|   |-- Create child
|   |-- Merge
|   +-- New with justification
+-- Not found -> Create + metadata + links
```

**Exceptions for separate docs:**
- Different spaces/projects
- Different product versions
- Different audiences (internal/external)
- Different languages

---

## Quality Checklist

### Structure
- [ ] Title is clear and searchable
- [ ] Has one-sentence summary
- [ ] Proper heading hierarchy (H1->H2->H3)
- [ ] Metadata complete (type, status, tags, owner)

### Content
- [ ] Purpose is clear
- [ ] Success criteria defined (for requirements)
- [ ] Scope defined (for specs)
- [ ] Evidence provided (for research)
- [ ] Action items assigned (for notes)

### Links
- [ ] References are valid
- [ ] Related docs linked
- [ ] Bidirectional links where needed

### Governance
- [ ] No duplicates exist
- [ ] Owner assigned
- [ ] Updated date current
- [ ] Status accurate

---

## Best Practices

1. **DRY Documentation** - Single source of truth, links instead of copies
2. **Living Documentation** - Updates with product changes
3. **Progressive Elaboration** - Ideas -> Research -> Requirements -> Implementation
4. **Search Optimization** - Clear titles, relevant keywords in tags
5. **Cross-linking** - Active use of references
6. **Templates** - Standardized structure for each type
7. **Validation** - Regular link checking
8. **Hierarchy** - Logical grouping, max 3-4 levels
9. **Metadata** - Fill for search and filtering
10. **Audience** - Write for the target reader

---

## When to Use This Skill

This skill provides documentation standards for all roles:

- **Product Managers**: BRD, PRD, ADR, research templates
- **System Analysts**: User stories, tech specs, API specs, process docs
- **Architects**: ADRs, tech specs
- **Developers**: Tech specs, API docs
- **QA Engineers**: Test cases, bug reports

Ensures consistent documentation quality across the organization.
