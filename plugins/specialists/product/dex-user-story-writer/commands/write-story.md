---
name: write-story
description: Create a user story with acceptance criteria following INVEST principles
---

# Write User Story Command

This command helps you create well-structured user stories following Agile best practices and INVEST criteria.

## Usage

```
/write-story [brief description or leave empty for interactive mode]
```

## Examples

```
/write-story user can reset password via email
/write-story
```

## Process

1. **Gather Information**
   - If description provided, analyze it
   - If not, ask for context:
     - Who is the user/role?
     - What do they want to do?
     - Why is this valuable?
     - Any specific requirements?

2. **Create User Story**
   - Write story in standard format
   - Ensure INVEST criteria are met
   - Add acceptance criteria (Given-When-Then)
   - Include technical notes
   - Define Definition of Done
   - Suggest story points

3. **Validate Story**
   - Check if story is independent
   - Verify it delivers value
   - Ensure it's testable
   - Confirm it's right-sized (1 sprint)

4. **Output**
   - Generate markdown-formatted story
   - Save to file or display in console
   - Optionally create in Azure DevOps/Jira

## Output Format

```markdown
## User Story: [Title]

**As a** [role]
**I want to** [goal]
**So that** [benefit]

### Acceptance Criteria

**Scenario 1: [Main scenario]**
Given [context]
When [action]
Then [outcome]

**Scenario 2: [Alternative scenario]**
Given [context]
When [action]
Then [outcome]

### Checklist
- [ ] AC1: [Specific criterion]
- [ ] AC2: [Specific criterion]
- [ ] AC3: [Specific criterion]

### Technical Notes

**API Changes:**
- Endpoint: POST /api/users/reset-password
- Request: { email: string }
- Response: { success: boolean, message: string }

**Database Changes:**
- Table: PasswordResetTokens
- Columns: Token, UserId, ExpiresAt, IsUsed

**Dependencies:**
- Email service (SendGrid)
- Redis for token storage (15 min expiry)

**Security:**
- Rate limiting: 3 requests per hour per IP
- Token valid for 15 minutes
- One-time use tokens

### Definition of Done

- [ ] Code implemented and reviewed
- [ ] Unit tests written (80%+ coverage)
- [ ] Integration tests pass
- [ ] API documented in Swagger
- [ ] Security review completed
- [ ] Deployed to test environment
- [ ] QA verified all acceptance criteria

### Story Points: 5
### Priority: Must Have
### Sprint: Sprint 12
### Dependencies: None
```

## Interactive Questions

If no description provided, the command will ask:

1. **User Role**: Who is this story for?
   - End user (customer)
   - Administrator
   - System/API consumer
   - Developer/Operations
   - Other (specify)

2. **Feature Area**: What part of the system?
   - Authentication/Authorization
   - User Management
   - Orders/Payments
   - Reporting
   - Integration
   - Infrastructure
   - Other (specify)

3. **Story Type**: What kind of work?
   - New feature
   - Enhancement
   - Bug fix
   - Technical debt
   - Spike/Research

4. **Priority**: How important?
   - Must Have (critical)
   - Should Have (important)
   - Could Have (nice to have)
   - Won't Have (future)

5. **Complexity**: How complex?
   - Simple (1-2 story points)
   - Medium (3-5 story points)
   - Complex (8 story points)
   - Epic (needs breakdown)

## INVEST Checklist

The command validates each story against INVEST criteria:

- **Independent**: Can be developed without other stories?
- **Negotiable**: Details can be refined during development?
- **Valuable**: Delivers clear business/user value?
- **Estimable**: Team can estimate effort?
- **Small**: Can be completed in one sprint?
- **Testable**: Has clear, verifiable acceptance criteria?

If any criteria fails, the command suggests improvements.

## .NET-Specific Templates

### API Story
```markdown
## User Story: [API Feature]

**As an** API consumer
**I want to** [action via API]
**So that** [integration benefit]

### API Specification

**Endpoint**: [METHOD] /api/[resource]
**Authentication**: Bearer token
**Request**:
\`\`\`json
{
  "field1": "string",
  "field2": 123
}
\`\`\`

**Response** (200 OK):
\`\`\`json
{
  "id": 1,
  "field1": "string",
  "createdAt": "2025-01-01T00:00:00Z"
}
\`\`\`

**Error Responses**:
- 400: Invalid request body
- 401: Unauthorized
- 404: Resource not found
- 500: Server error
```

### Database Story
```markdown
## User Story: [Data Feature]

**As a** system
**I need to** [data operation]
**So that** [data benefit]

### Database Changes

**Migration**: AddUserPreferencesTable

**Schema**:
\`\`\`sql
CREATE TABLE UserPreferences (
    Id INT PRIMARY KEY IDENTITY,
    UserId INT NOT NULL,
    Theme NVARCHAR(50),
    Language NVARCHAR(10),
    NotificationsEnabled BIT,
    CreatedAt DATETIME2 NOT NULL,
    UpdatedAt DATETIME2 NOT NULL,
    FOREIGN KEY (UserId) REFERENCES Users(Id)
);
\`\`\`

**Indexes**:
- IX_UserPreferences_UserId (clustered)

**Entity**:
\`\`\`csharp
public class UserPreferences
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Theme { get; set; }
    public string Language { get; set; }
    public bool NotificationsEnabled { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; }
}
\`\`\`
```

### Background Job Story
```markdown
## User Story: [Scheduled Task]

**As a** system administrator
**I want** [automated task]
**So that** [automation benefit]

### Job Configuration

**Scheduler**: Hangfire
**Frequency**: [Cron expression]
**Timeout**: [max execution time]
**Retry**: [retry policy]

**Implementation**:
\`\`\`csharp
RecurringJob.AddOrUpdate<ReportGenerationService>(
    "generate-daily-reports",
    x => x.GenerateDailyReportsAsync(CancellationToken.None),
    "0 6 * * *", // Every day at 6:00 AM
    new RecurringJobOptions
    {
        TimeZone = TimeZoneInfo.Utc
    }
);
\`\`\`
```

## Output Options

After generating the story, choose:

1. **Display in console**: Show formatted output
2. **Save to file**: Write to markdown file
3. **Copy to clipboard**: Ready to paste
4. **Create work item**: Push to Azure DevOps/Jira
5. **Add to backlog**: Append to BACKLOG.md

## Tips

- Keep stories focused on single piece of value
- Write from user's perspective
- Make acceptance criteria specific and testable
- Include both positive and negative scenarios
- Add enough technical detail for developers
- Link related stories and dependencies
- Review with team before committing to sprint

## Related Commands

- `/api-spec`: Generate OpenAPI specification
- `/dotnet-test`: Run tests for acceptance criteria
- `/code-review`: Review implementation of story

Remember: A user story is a placeholder for a conversation, not a detailed specification. It should be just enough to start development and trigger discussions.
