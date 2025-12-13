# DEX System Analyst Plugin

> Comprehensive System Analyst toolkit для requirements analysis, User Stories, BPMN modeling и API specifications.

## Описание

Plugin для системных аналитиков. Предоставляет AI-ассистентов, команды и best practices для:

- Requirements analysis
- User Stories creation (INVEST criteria)
- BPMN process modeling
- API specifications (OpenAPI/Swagger)
- Acceptance criteria definition

## Компоненты

### 🤖 Agents

**requirements-analyst** - Анализ требований
- Requirements gathering и elicitation
- Stakeholder analysis
- Functional/Non-functional requirements
- Requirements prioritization
- Triggers: `requirements`, `требования`, `analyze requirements`, `собрать требования`

**business-requirements-analyst** - Бизнес-требования и планирование
- Формализация бизнес-идей в цели и задачи
- Анализ вариантов использования и value proposition
- Критический анализ предложений и выявление рисков
- Декомпозиция от высокоуровневых целей до этапов реализации
- Создание полного плана: стейкхолдеры, данные, интеграции, критерии приемки
- Triggers: `бизнес требования`, `business requirements`, `формализовать идею`, `analyze idea`, `план реализации`

**user-story-writer** - Написание User Stories
- User Story format (As a..., I want..., So that...)
- Acceptance Criteria (Given-When-Then)
- Story splitting techniques
- INVEST criteria validation
- Triggers: `user story`, `write story`, `user stories`, `пользовательская история`

**process-modeler** - BPMN моделирование
- BPMN diagram creation
- Process flow analysis
- Swimlane diagrams
- Business process optimization
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

**user-stories** - User Story best practices
```
Активируется при:
- User Story writing
- Acceptance Criteria definition
- Story splitting
- Backlog refinement

Включает:
- INVEST criteria (Independent, Negotiable, Valuable, Estimable, Small, Testable)
- As a..., I want..., So that... format
- Given-When-Then acceptance criteria
- Story splitting patterns
- Definition of Ready/Done
```

**bpmn-modeling** - BPMN 2.0 patterns
```
Активируется при:
- Process modeling
- Workflow documentation
- Business process analysis

Включает:
- BPMN 2.0 notation
- Events, Activities, Gateways
- Swimlanes (Pools, Lanes)
- Process optimization patterns
- Happy path + exception flows
```

**api-specification** - OpenAPI/Swagger
```
Активируется при:
- API documentation
- Contract definition
- REST API design

Включает:
- OpenAPI 3.0 structure
- HTTP methods (GET, POST, PUT, DELETE)
- Request/Response schemas
- Authentication (Bearer, OAuth2)
- Error responses (4xx, 5xx)
- Pagination patterns
```

**confluence-worker** - Confluence documentation
```
Активируется при:
- Confluence search, create, update
- Documentation organization
- Template management

Включает:
- Search/create/update Confluence pages
- Cross-reference links management
- Content duplication detection
- Template-based page creation
- Markdown/Wiki format support
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

---

**Version:** 2.2.0
**Author:** DEX Team
**Requires:** Notion MCP server
**Tags:** system-analyst, requirements, user-stories, bpmn, api-specification
