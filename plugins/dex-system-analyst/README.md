# DEX System Analyst Plugin

> System Analyst toolkit для детализации requirements, написания User Stories, BPMN моделирования и API спецификаций. **Работает на уровне technical specs и implementation details.**

## Описание

Plugin для системных аналитиков, работающих с .NET командами. Фокус на **tactical level** - детальные user stories, acceptance criteria, технические спецификации. Epic planning и business requirements - это работа Product Manager.

Предоставляет AI-ассистентов, команды и best practices для:

- **Requirements Analysis** - детализация и gap analysis
- **User Stories Writing** - INVEST criteria, Given-When-Then AC
- **BPMN Process Modeling** - процессы и workflows
- **API Specifications** - OpenAPI/Swagger contracts
- **Documentation Management** - универсальная работа с docs (Confluence, Notion, MkDocs, GitBook)

**НЕ включает:**
- ❌ Epic planning (это Product Manager)
- ❌ Roadmap planning (это Product Manager)
- ❌ Business metrics analysis (это Product Manager)

## Компоненты

### 🤖 Agents

**requirements-analyst** - Системный анализ и детализация требований
- Requirements gathering и elicitation
- Gap analysis и completeness check
- Functional/Non-functional requirements decomposition
- Stakeholder analysis
- Requirements traceability
- Triggers: `requirements`, `требования`, `analyze requirements`, `собрать требования`

**user-story-writer** - Написание детальных User Stories
- User Story format (As a..., I want..., So that...)
- Acceptance Criteria (Given-When-Then)
- INVEST criteria validation
- Story splitting techniques
- Definition of Ready/Done
- Decompose epics (from PM) → detailed stories
- Triggers: `user story`, `write story`, `user stories`, `пользовательская история`

**process-modeler** - BPMN процессы и workflows
- BPMN 2.0 diagram creation
- Process flow analysis
- Swimlane diagrams (pools, lanes)
- Business process optimization
- Happy path + exception flows
- Triggers: `bpmn`, `process model`, `бизнес-процесс`, `workflow`

### ⚡ Commands

**`/write-story`** - Создание User Story
```
Генерирует properly structured User Story:
- As a [role], I want [feature], So that [benefit]
- Acceptance Criteria (Given-When-Then)
- Story points estimation
- Dependencies identification
- Saves to Notion
```

**`/api-spec`** - OpenAPI спецификация
```
Создаёт API specification:
- OpenAPI 3.0 format
- Endpoints documentation
- Request/Response schemas
- Authentication схемы
- Validation rules
```

### 🎯 Skills

**agile-fundamentals** (shared) - Базовые Agile концепции
```
Shared skill для PM и SA ролей
Активируется при: Agile planning, role clarification

Включает:
- Agile иерархия: Portfolio → Initiative → Epic → Story → Task
- INVEST criteria
- Definition of Ready/Done
- Story sizing reference
- PM vs SA responsibilities
```

**user-stories** - User Story writing best practices
```
Активируется при:
- User Story decomposition from epics
- Acceptance Criteria writing
- Story splitting и refinement
- INVEST validation

Включает:
- INVEST criteria (Independent, Negotiable, Valuable, Estimable, Small, Testable)
- As a..., I want..., So that... format
- Given-When-Then acceptance criteria
- Story splitting patterns (by workflow, CRUD, data variations)
- Definition of Ready/Done
- .NET-specific story patterns (API, DB, background jobs)
```

**bpmn-modeling** - BPMN 2.0 процессы
```
Активируется при:
- Process modeling и documentation
- Workflow analysis
- Business process optimization

Включает:
- BPMN 2.0 notation (Events, Activities, Gateways)
- Swimlanes (Pools, Lanes)
- Process optimization patterns
- Happy path + exception flows
- Integration points mapping
```

**api-specification** - OpenAPI/Swagger спецификации
```
Активируется при:
- API contract definition
- REST API documentation
- API design review

Включает:
- OpenAPI 3.0 structure
- HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Request/Response schemas (JSON, XML)
- Authentication (Bearer, OAuth2, API Keys)
- Error responses (4xx, 5xx)
- Pagination, filtering, sorting patterns
- Versioning strategies
```

**doc-worker** - Universal documentation management
```
Активируется при:
- Documentation work (docs, wiki, knowledge base)
- Cross-platform: Confluence, Notion, GitBook, MkDocs, Markdown

Включает:
- Auto-detect documentation platform
- Search/create/update documents universally
- Cross-reference links management
- Content duplication detection
- Template-based creation (User Stories, API docs, Runbooks, Release Notes)
- Hierarchy and breadcrumbs support
- Broken link detection and fixes
```

### 📝 System Prompt

System Analyst system prompt с:
- Requirements gathering techniques
- User Story writing best practices
- BPMN notation standards
- API design principles
- Documentation standards

## Configuration

This plugin requires Notion MCP server to be configured with environment variables.

### Required Environment Variables

**Notion Integration**
- `NOTION_API_KEY` - Notion API key (Internal Integration Token)
  - Get from: https://www.notion.so/my-integrations
  - Required for: Requirements documentation, User Stories, Process diagrams

### Setup Instructions

1. **Create Notion Integration:**
   - Open https://www.notion.so/my-integrations
   - Click "Create New Integration"
   - Give it a name (e.g., "Claude Code - System Analyst")
   - Copy the "Internal Integration Token"

2. **Share Notion pages** with your integration:
   - Open your Requirements database in Notion
   - Click "Share" → "Invite"
   - Select your integration

3. **Set environment variable:**
   ```bash
   export NOTION_API_KEY="ntn_xxxxxxxxxxxxx"
   ```

4. **Verify configuration:**
   ```bash
   claude
   /mcp list
   ```

## Quick Start

### 1. Установка

```bash
# Скопируйте плагин в .claude/plugins/
cp -r dex-system-analyst ~/.claude/plugins/

# Или через marketplace (когда доступно)
claude plugin install dex-system-analyst
```

### 2. Configuration

See the **[Configuration](#configuration)** section above for Notion setup instructions.

### 3. Использование

**User Stories:**
```
/write-story                     # Interactive story creation
"Напиши User Story для регистрации пользователя"
"Добавь acceptance criteria для login feature"
"Раздели большую story на smaller stories"
```

**API Specifications:**
```
/api-spec                        # Create OpenAPI spec
"Создай API спецификацию для User endpoint"
"Документируй REST API для Product catalog"
```

**Process Modeling:**
```
"Создай BPMN диаграмму для order processing"
"Опиши бизнес-процесс approval workflow"
"Оптимизируй process flow для customer support"
```

## Best Practices

### User Stories

✅ **DO:**
- Follow INVEST criteria
- Use "As a..., I want..., So that..." format
- Define clear acceptance criteria (Given-When-Then)
- Keep stories small (1-3 days of work)
- Include Definition of Ready/Done

❌ **DON'T:**
- Technical tasks вместо User Stories
- Vague acceptance criteria
- Too large stories (epics)
- Missing "So that" (benefit/value)
- Forget stakeholder perspective

### BPMN Modeling

✅ **DO:**
- Use standard BPMN 2.0 notation
- Define start/end events clearly
- Use swimlanes для different actors
- Model both happy path и exceptions
- Keep diagrams readable (not too complex)

❌ **DON'T:**
- Mix BPMN с другими notations
- Overcomplicate diagrams
- Forget exception flows
- Use ambiguous labels
- Ignore business rules

### API Specifications

✅ **DO:**
- Follow REST principles
- Use standard HTTP status codes
- Document all endpoints
- Include examples
- Define error responses
- Version your API (/v1, /v2)

❌ **DON'T:**
- Use verbs в endpoint URLs (use HTTP methods)
- Return 200 OK для errors
- Skip authentication documentation
- Forget pagination
- Inconsistent naming conventions

## Структура Notion (рекомендуется)

### Requirements Database
```
- Title (text)
- Type (select: Functional, Non-Functional, Business Rule)
- Priority (select: Must Have, Should Have, Could Have, Won't Have)
- Status (select: Draft, Review, Approved, Implemented)
- Stakeholder (person)
- Related Stories (relation)
```

### User Stories Database
```
- Title (text)
- Story (text) - As a..., I want..., So that...
- Acceptance Criteria (text) - Given-When-Then
- Story Points (number)
- Status (select: Backlog, Ready, In Progress, Done)
- Sprint (relation)
- Epic (relation)
```

### API Documentation Database
```
- Endpoint (text)
- Method (select: GET, POST, PUT, DELETE)
- Request Schema (text)
- Response Schema (text)
- Status Codes (text)
- Authentication (select)
```

## Templates

Плагин создаёт Notion templates для:
- User Story template
- API Endpoint template
- Requirements document template
- BPMN process description template

## Integration с .NET Workflow

Этот плагин designed для .NET команд:

- **Notion**: Primary documentation tool
- **User Stories**: Link к GitLab issues
- **API Specs**: Export to OpenAPI YAML → ASP.NET controllers

Example workflow:
```
1. Gather requirements
2. Create User Stories в Notion
3. Design API specifications
4. Model business processes (BPMN)
5. Link Stories → GitLab Issues
6. Development team implements
7. Validate against acceptance criteria
```

## Troubleshooting

**Notion integration not working:**
```bash
# Verify API key
echo $NOTION_API_KEY

# Check if pages are shared with integration
# In Notion: Settings & Members → Connections
```

**User Story format issues:**
```
# Validate INVEST criteria:
I - Independent (can be developed separately)
N - Negotiable (details can be discussed)
V - Valuable (delivers value to users)
E - Estimable (team can estimate effort)
S - Small (fits in one sprint)
T - Testable (clear acceptance criteria)
```

**BPMN complexity:**
```
# Simplify diagram:
- Split complex process into sub-processes
- Use separate diagrams for exception flows
- Group related activities
- Limit swimlanes to 3-4
```

## Roadmap

- [ ] Jira integration для User Stories sync
- [ ] Confluence integration
- [ ] Use Case diagram generation
- [ ] Requirements traceability matrix
- [ ] Automated story splitting suggestions

## License

См. корневой LICENSE файл проекта.

## SA vs PM: Role Separation

### System Analyst (THIS plugin)
**Focus:** Tactical level, technical details, implementation specs

**Responsibilities:**
- 📝 User stories writing from epics (INVEST, AC)
- ✅ Acceptance criteria (Given-When-Then)
- 🔄 BPMN процессы и workflows
- 🔌 API specifications (OpenAPI/Swagger)
- 📄 Technical documentation

**NOT responsible for:**
- ❌ Epic planning (→ Product Manager)
- ❌ Roadmap planning (→ Product Manager)
- ❌ Business metrics (→ Product Manager)
- ❌ Strategic prioritization (→ Product Manager)

### Product Manager (separate plugin: dex-product-manager)
**Focus:** Strategic level, business value, high-level planning

**Responsibilities:**
- 📋 Epics creation and management
- 🗺️ Roadmap planning
- 💡 Business requirements
- 📊 Metrics, KPIs, OKRs

### Collaboration Flow
```
1. PM создает Epic (business value, metrics, high-level scope)
   ↓
2. PM + SA: refinement session (alignment discussion)
   ↓
3. SA декомпозирует Epic → User Stories (detailed INVEST + AC)
   ↓
4. PM reviews stories for business value alignment
   ↓
5. PM + SA: prioritize stories within epic
   ↓
6. Dev Team estimates and implements
```

---

**Version:** 2.5.0
**Author:** DEX Team
**Requires:** Notion MCP server
**Tags:** system-analyst, requirements, user-stories, bpmn, api-specification, acceptance-criteria
