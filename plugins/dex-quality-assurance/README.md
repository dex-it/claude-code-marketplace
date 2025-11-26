# DEX Quality Assurance Plugin

> Comprehensive QA toolkit для test design, test automation, API testing и bug reporting.

## Описание

Plugin для QA инженеров. Предоставляет AI-ассистентов, команды и best practices для:

- Test design и test case creation
- Test automation (Playwright, Selenium)
- API testing (REST, GraphQL)
- Bug reporting
- Test coverage analysis

## Компоненты

### 🤖 Agents

**test-analyst** - Test Design
- Test case creation
- Test scenario identification
- Equivalence partitioning
- Boundary value analysis
- Decision table testing
- Triggers: `test case`, `test design`, `тест-кейс`, `test scenario`, `test plan`

**test-automator** - Test Automation
- Playwright test generation
- Selenium WebDriver tests
- Page Object Model implementation
- Test data management
- CI/CD integration
- Triggers: `automate`, `playwright`, `selenium`, `автоматизация тестов`, `e2e test`

**bug-reporter** - Bug Reporting
- Structured bug reports
- Reproduction steps
- Severity/Priority assessment
- Screenshots и logs attachment
- GitLab issue creation
- Triggers: `bug report`, `issue`, `баг`, `дефект`, `report bug`

### ⚡ Commands

**`/analyze-story`** - Анализ User Story для тестирования
```
Создаёт test cases из User Story:
- Identify test scenarios
- Happy path + negative cases
- Edge cases detection
- Acceptance criteria → test cases mapping
- Test data requirements
```

**`/create-tests`** - Генерация автоматизированных тестов
```
Создаёт automated tests:
- Playwright/Selenium test code
- Page Object classes
- Test fixtures и setup
- Assertions based on requirements
- Data-driven test patterns
```

### 🎯 Skills

**test-design** - Test Design Techniques
```
Активируется при:
- Test case creation
- Test scenario identification
- Coverage analysis

Включает:
- Equivalence Partitioning
- Boundary Value Analysis
- Decision Table Testing
- State Transition Testing
- Use Case Testing
- Exploratory Testing techniques
```

**api-testing** - REST/GraphQL API Testing
```
Активируется при:
- API test creation
- Contract testing
- Integration testing

Включает:
- REST API testing patterns
- GraphQL query testing
- Authentication testing
- Response validation
- Status code verification
- Schema validation
- Performance testing basics
```

### 📝 System Prompt

QA Engineer system prompt с:
- Testing methodologies (Black Box, White Box, Grey Box)
- Test automation frameworks
- Bug lifecycle
- Test documentation standards
- Quality metrics

## Configuration

This plugin requires GitLab MCP server to be configured with environment variables.

### Required Environment Variables

**GitLab Integration**
- `GITLAB_TOKEN` - GitLab Personal Access Token
  - Get from: https://gitlab.com/-/user_settings/personal_access_tokens
  - Scopes: `api`, `read_repository`, `write_repository`
  - Required for: Bug reporting, test case management, CI/CD integration

### Optional Environment Variables

- `GITLAB_API_URL` - GitLab instance URL
  - Default: `https://gitlab.com/api/v4`
  - Use custom URL for self-hosted GitLab

### Setup Instructions

1. **Create GitLab Personal Access Token:**
   - Open https://gitlab.com/-/user_settings/personal_access_tokens
   - Click "Add new token"
   - Select scopes: `api`, `read_repository`, `write_repository`
   - Copy the generated token

2. **Set environment variable:**
   ```bash
   export GITLAB_TOKEN="glpat-xxxxxxxxxxxxx"
   export GITLAB_API_URL="https://gitlab.com/api/v4"  # Optional
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
cp -r dex-quality-assurance ~/.claude/plugins/

# Или через marketplace (когда доступно)
claude plugin install dex-quality-assurance
```

### 2. Configuration

See the **[Configuration](#configuration)** section above for GitLab setup instructions.

### 3. Использование

**Test Design:**
```
/analyze-story                   # Analyze User Story for testing
"Создай test cases для login feature"
"Какие edge cases для registration form?"
"Equivalence partitioning для age field"
```

**Test Automation:**
```
/create-tests                    # Generate automated tests
"Создай Playwright test для login page"
"Автоматизируй API тест для User endpoint"
"Page Object для checkout page"
```

**Bug Reporting:**
```
"Создай bug report для login issue"
"Report bug: Cannot submit form без email"
```

## Best Practices

### Test Design

✅ **DO:**
- Cover happy path, negative cases, edge cases
- Use equivalence partitioning для efficient coverage
- Test boundary values
- Include exploratory testing
- Document test data requirements
- Link test cases → requirements

❌ **DON'T:**
- Only test happy path
- Ignore edge cases
- Forget negative testing
- Skip boundary value analysis
- Duplicate test scenarios
- Test without clear expected results

### Test Automation

✅ **DO:**
- Use Page Object Model
- Write maintainable, readable tests
- Use explicit waits (не implicit/sleep)
- Implement data-driven testing
- Run tests в CI/CD pipeline
- Use unique test data

❌ **DON'T:**
- Use hard-coded waits (Thread.sleep)
- Hardcode test data
- Create flaky tests
- Ignore test failures
- Test UI too deeply (prefer API tests)
- Forget test independence

### Bug Reporting

✅ **DO:**
- Clear, descriptive title
- Steps to reproduce
- Expected vs Actual results
- Screenshots/logs
- Environment details
- Severity/Priority classification

❌ **DON'T:**
- Vague descriptions ("doesn't work")
- Missing reproduction steps
- No environment info
- Duplicate bug reports
- Emotion в bug reports
- Assign severity randomly

## Test Automation Frameworks

### Playwright (Recommended)

```typescript
import { test, expect, Page } from '@playwright/test';

test.describe('Login functionality', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('successful login with valid credentials', async () => {
    await loginPage.login('user@example.com', 'password123');
    await expect(loginPage.welcomeMessage).toBeVisible();
  });

  test('error message with invalid credentials', async () => {
    await loginPage.login('invalid@example.com', 'wrong');
    await expect(loginPage.errorMessage).toContainText('Invalid credentials');
  });
});

// Page Object
class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.fill('#email', email);
    await this.page.fill('#password', password);
    await this.page.click('button[type="submit"]');
  }

  get welcomeMessage() {
    return this.page.locator('.welcome');
  }

  get errorMessage() {
    return this.page.locator('.error');
  }
}
```

### API Testing

```typescript
import { test, expect } from '@playwright/test';

test.describe('User API', () => {
  test('GET /api/users returns user list', async ({ request }) => {
    const response = await request.get('/api/users');

    expect(response.status()).toBe(200);

    const users = await response.json();
    expect(users).toBeInstanceOf(Array);
    expect(users.length).toBeGreaterThan(0);
  });

  test('POST /api/users creates new user', async ({ request }) => {
    const newUser = {
      name: 'Test User',
      email: 'test@example.com'
    };

    const response = await request.post('/api/users', {
      data: newUser
    });

    expect(response.status()).toBe(201);

    const created = await response.json();
    expect(created).toMatchObject(newUser);
    expect(created.id).toBeDefined();
  });
});
```

## Bug Report Template

```markdown
**Title:** [Brief description of the issue]

**Environment:**
- OS: Windows 11 / macOS 14 / Ubuntu 22.04
- Browser: Chrome 120.0.6099.130
- Application Version: 2.5.0
- Server: Staging / Production

**Steps to Reproduce:**
1. Navigate to /login page
2. Enter email: test@example.com
3. Click "Login" button without entering password
4. Observe error message

**Expected Result:**
Validation error: "Password is required"

**Actual Result:**
500 Internal Server Error

**Severity:** High
**Priority:** P1

**Additional Info:**
- Occurs only when email field is filled
- Works correctly if both fields empty
- Console error: TypeError: Cannot read property 'length' of undefined

**Attachments:**
- Screenshot: error-screenshot.png
- Browser Console Log: console-log.txt
```

## Integration с .NET Workflow

Этот плагин designed для .NET команд:

- **GitLab**: Bug tracking, test case management
- **CI/CD**: Automated tests в GitLab CI pipeline
- **API Testing**: REST API endpoints testing

Example workflow:
```
1. Receive User Story
2. Analyze story (/analyze-story)
3. Create test cases
4. Implement automated tests (/create-tests)
5. Run tests locally
6. Commit to GitLab
7. CI/CD runs tests automatically
8. Report bugs if found
```

## Troubleshooting

**Playwright tests failing:**
```bash
# Update Playwright
npx playwright install

# Run with debug mode
npx playwright test --debug

# Check screenshots
npx playwright test --headed
```

**GitLab integration issues:**
```bash
# Verify token
echo $GITLAB_TOKEN

# Test API access
curl -H "PRIVATE-TOKEN: $GITLAB_TOKEN" https://gitlab.com/api/v4/user
```

## Roadmap

- [ ] Visual regression testing integration
- [ ] Performance testing templates (K6, JMeter)
- [ ] Mobile testing patterns (Appium)
- [ ] Accessibility testing automation
- [ ] Test reporting dashboards

## License

См. корневой LICENSE файл проекта.

---

**Version:** 2.0.0
**Author:** DEX Team
**Requires:** GitLab MCP server
**Tags:** qa, testing, playwright, selenium, api-testing, automation
