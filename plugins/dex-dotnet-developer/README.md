# DEX .NET Developer Plugin

> Comprehensive .NET Developer toolkit для coding, debugging, testing и best practices.

## Описание

Plugin для .NET разработчиков. Предоставляет AI-ассистентов, команды и best practices для:

- C# coding и архитектурные паттерны
- Entity Framework Core
- Async/await patterns
- LINQ optimization
- API development (ASP.NET Core)
- Unit testing (xUnit, Moq)

## Компоненты

### 🤖 Agents

**coding-assistant** - Написание кода
- C# code generation
- SOLID principles application
- Design patterns implementation
- Code refactoring suggestions
- Triggers: `implement`, `create`, `add feature`, `написать код`, `реализовать`

**bug-hunter** - Поиск и исправление багов
- Bug diagnosis и root cause analysis
- Stack trace analysis
- Memory leak detection
- Performance issue identification
- Triggers: `bug`, `error`, `exception`, `debug`, `ошибка`, `не работает`

**code-reviewer** - Code review
- Code quality assessment
- Best practices validation
- Security vulnerability detection
- Performance optimization suggestions
- Triggers: `review`, `check code`, `code quality`, `проверь код`, `ревью`

**test-writer** - Генерация тестов
- xUnit test generation
- Moq mock setup
- Test coverage analysis
- Test data builders
- Triggers: `test`, `unit test`, `testing`, `тест`, `покрытие`

### ⚡ Commands

**`/build`** - Сборка проекта
```
Выполняет dotnet build с анализом:
- Компиляция solution/project
- Анализ ошибок и warnings
- Suggestions для исправления
- Build performance metrics
```

**`/test`** - Запуск тестов
```
Выполняет dotnet test:
- Запуск всех или отфильтрованных тестов
- Coverage report
- Failed tests analysis
- Performance test results
```

**`/debug`** - Помощь в отладке
```
Debugging assistance:
- Stack trace analysis
- Exception investigation
- Variable state examination
- Breakpoint suggestions
```

**`/ef-migration`** - EF Core миграции
```
Entity Framework миграции:
- Add migration with changes detection
- Update database
- Migration rollback support
- Seed data suggestions
```

**`/refactor`** - Рефакторинг кода
```
Code refactoring recommendations:
- Extract method/class suggestions
- Rename symbols
- Move code между files
- Simplification opportunities
```

### 🎯 Skills

**dotnet-patterns** - .NET архитектурные паттерны
```
Активируется при:
- Repository pattern
- Unit of Work
- Dependency Injection
- Options pattern
- Result<T> pattern

Включает:
- Repository + UnitOfWork implementation
- DI container configuration
- Result<T> для error handling
- Configuration patterns (IOptions)
```

**ef-core** - Entity Framework Core best practices
```
Активируется при:
- DbContext configuration
- Entity mapping
- Migrations
- Query optimization

Включает:
- DbContext patterns (scoped lifetime)
- Fluent API configuration
- Navigation properties
- Query optimization (AsNoTracking, Include)
- Migration best practices
```

**async-patterns** - Async/await best practices
```
Активируется при:
- Async method implementation
- Task-based programming
- Cancellation tokens
- Async LINQ

Включает:
- async/await правильное использование
- CancellationToken patterns
- ConfigureAwait guidelines (не нужен в ASP.NET Core)
- ValueTask optimization
- Async streams (IAsyncEnumerable)
```

**linq-optimization** - LINQ performance
```
Активируется при:
- LINQ queries
- Collection operations
- Performance optimization

Включает:
- Deferred execution
- IEnumerable vs IQueryable
- Materialization patterns (ToList, ToArray)
- Query vs Method syntax
- Avoid N+1 queries
```

**api-development** - ASP.NET Core API
```
Активируется при:
- Controller creation
- Middleware implementation
- API versioning
- OpenAPI/Swagger

Включает:
- Controller patterns (async actions)
- DTOs и AutoMapper
- Model validation
- Error handling middleware
- API versioning strategies
```

**testing-patterns** - Unit testing best practices
```
Активируется при:
- xUnit test creation
- Mocking (Moq)
- Test data builders
- Integration tests

Включает:
- AAA pattern (Arrange-Act-Assert)
- Test naming conventions
- Moq setup patterns
- Test data builders
- FluentAssertions usage
```

### 📝 System Prompt

.NET Developer system prompt с:
- Technology stack (.NET 8+, C#, EF Core)
- Coding conventions (async/await, DI, Result<T>)
- Best practices для enterprise applications
- Common anti-patterns to avoid

## Configuration

This plugin requires multiple MCP servers to be configured with environment variables.

### Required Environment Variables

**GitLab Integration**
- `GITLAB_TOKEN` - GitLab Personal Access Token
  - Get from: https://gitlab.com/-/user_settings/personal_access_tokens
  - Scopes: `api`, `read_repository`, `write_repository`
  - Required for: Code versioning, CI/CD integration

**Notion Integration**
- `NOTION_API_KEY` - Notion API key (Internal Integration Token)
  - Get from: https://www.notion.so/my-integrations
  - Required for: Documentation, technical notes

### Optional Environment Variables

**Supabase (PostgreSQL) Integration**
- `DATABASE_URL` - PostgreSQL connection string
  - Format: `postgresql://user:password@host:port/database`
  - Default: `postgresql://user:password@localhost:5432/dbname`
  - Required for: Database operations, EF Core migrations

**GitLab API**
- `GITLAB_API_URL` - GitLab instance URL
  - Default: `https://gitlab.com/api/v4`
  - Use custom URL for self-hosted GitLab

### Setup Instructions

1. **Create tokens:**
   - **GitLab**: https://gitlab.com/-/user_settings/personal_access_tokens
   - **Notion**: https://www.notion.so/my-integrations

2. **Set environment variables:**
   ```bash
   export GITLAB_TOKEN="glpat-xxxxxxxxxxxxx"
   export NOTION_API_KEY="ntn_xxxxxxxxxxxxx"
   export DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"  # Optional
   export GITLAB_API_URL="https://gitlab.com/api/v4"                 # Optional
   ```

3. **Verify configuration:**
   ```bash
   claude
   /mcp list
   ```

## Quick Start

### 1. Установка

```bash
# Скопируйте плагин в .claude/plugins/
cp -r dex-dotnet-developer ~/.claude/plugins/

# Или через marketplace (когда доступно)
claude plugin install dex-dotnet-developer
```

### 2. Configuration

See the **[Configuration](#configuration)** section above for detailed setup instructions.

### 3. Использование

**Coding:**
```
"Implement repository pattern для User entity"
"Create API controller для Product"
"Add async method с cancellation token"
```

**Debugging:**
```
/debug                           # Analyze current error
"Помоги найти причину NullReferenceException"
"Почему async method deadlocks?"
```

**Testing:**
```
"Создай unit тесты для UserService"
"Add integration test для API endpoint"
/test                            # Run all tests
```

**Entity Framework:**
```
/ef-migration AddUserTable       # Create migration
"Оптимизируй EF query - N+1 problem"
"Configure many-to-many relationship"
```

## Best Practices

### Async/Await

✅ **DO:**
- Use async/await для I/O operations
- Add CancellationToken parameters
- Return Task<T> or ValueTask<T>
- Use IAsyncEnumerable для streaming

❌ **DON'T:**
- ConfigureAwait(false) в ASP.NET Core (не нужно)
- async void (только для event handlers)
- Blocking calls (.Result, .Wait())
- Forget cancellation token support

### Entity Framework Core

✅ **DO:**
- Use AsNoTracking() для read-only queries
- Include related data explicitly
- Use migrations для schema changes
- Configure indexes на часто используемые поля

❌ **DON'T:**
- DbContext long-lived instances (use scoped)
- Lazy loading без explicit configuration
- N+1 queries (use Include/ThenInclude)
- Raw SQL injection vulnerabilities

### LINQ

✅ **DO:**
- Defer execution when possible
- Use IQueryable для database queries
- Materialize (ToList) в appropriate moment
- Use Where before Select для filtering

❌ **DON'T:**
- Enumerate multiple times
- Use Count() > 0 (use Any())
- Forget FirstOrDefault can return null
- Create unnecessary intermediate collections

## Integration с .NET Workflow

Этот плагин designed для .NET команд:

- **GitLab**: Code versioning, CI/CD integration
- **Supabase**: PostgreSQL для EF Core development
- **Notion**: Technical documentation, ADRs

Example workflow:
```
1. Create feature branch
2. Implement code (coding-assistant)
3. Write tests (test-writer)
4. Review code (code-reviewer)
5. Create migration (/ef-migration)
6. Commit to GitLab
7. CI/CD pipeline runs (/build, /test)
```

## Troubleshooting

**EF Core migration fails:**
```bash
# Check DbContext configuration
dotnet ef dbcontext info

# Generate SQL script
dotnet ef migrations script

# Verify connection string
echo $DATABASE_URL
```

**Tests failing:**
```bash
# Run specific test
dotnet test --filter "FullyQualifiedName~TestClassName"

# Verbose output
dotnet test --logger "console;verbosity=detailed"

# Collect coverage
dotnet test /p:CollectCoverage=true
```

**Build errors:**
```bash
# Clean и rebuild
dotnet clean
dotnet build --no-incremental

# Restore packages
dotnet restore
```

## License

См. корневой LICENSE файл проекта.

---

**Version:** 2.0.0
**Author:** DEX Team
**Requires:** GitLab MCP, Notion MCP, Optional: Supabase MCP
**Tags:** dotnet, csharp, developer, ef-core, aspnetcore, testing
