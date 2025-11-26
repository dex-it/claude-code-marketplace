---
name: release-notes
description: Генерация release notes на основе завершённых items
---

# Release Notes Command

Эта команда автоматически генерирует release notes из завершённых features, improvements и bug fixes.

## Процесс

### 1. Define Release Scope

Спросите у пользователя:

**Required:**
- Version Number: (например "v2.5.0", "Sprint 23", "Q4 2025")
- Date Range: от какой до какой даты включать items

**Optional:**
- Release Name: themed name (например "Performance Boost", "Mobile First")
- Target Audience: internal, customers, public
- Format: markdown, Notion page, email, blog post

**Defaults:**
- Date Range: last sprint (2 weeks) или since last release tag
- Audience: customers
- Format: markdown

### 2. Fetch Completed Items

Используйте Notion MCP или Git:

#### From Notion Backlog

```
Query:
- Status: Done / Shipped / Released
- Completed Date: within date range
- Types: все (Feature, Bug, Improvement, etc.)

Exclude:
- Internal tasks (не customer-facing)
- Tech debt (unless significant impact)
- Items marked as "Don't include in release notes"
```

#### From Git (Alternative)

```bash
# Если используется conventional commits
git log --oneline v2.4.0..HEAD --grep="^feat:" --grep="^fix:"

# Группировка по типу
git log --pretty=format:"%s" v2.4.0..HEAD | grep "^feat:"
```

### 3. Categorize Items

Группируйте по categories:

**Standard Categories:**
```
🎉 New Features: новый functionality
✨ Improvements: enhancements существующих features
🐛 Bug Fixes: исправленные issues
⚡ Performance: speed/efficiency improvements
🔒 Security: security fixes
📝 Documentation: doc updates
🗑️ Deprecations: deprecated features
⚠️ Breaking Changes: changes требующие action от users
```

**Custom Categories** (по product area):
```
📱 Mobile: mobile-specific changes
🖥️ Desktop: desktop-specific
🔗 Integrations: third-party integrations
💳 Payments: payment-related
👤 User Management: auth, profiles
```

### 4. Transform to User-Friendly Language

Для каждого item:

**Before (technical):**
```
"Refactored authentication service to use JWT tokens"
"Optimized SQL queries in user dashboard"
"Fixed null pointer exception in payment processing"
```

**After (user-friendly):**
```
"Improved login security with industry-standard authentication"
"Faster dashboard loading times"
"Resolved issue where payments could fail unexpectedly"
```

**Transformation Guidelines:**
```
1. Focus on user benefit, not technical details
2. Use active voice ("You can now..." vs "Feature was added...")
3. Explain the "so what": why users should care
4. Remove jargon (API, refactor, optimization → plain language)
5. Be specific but concise (what changed, not how)
```

### 5. Prioritize Items

Не все items equally важны для users:

**Highlight (Top Section):**
- Major features
- Frequently requested features
- Significant improvements
- Critical bug fixes

**Standard List:**
- Regular features
- Minor improvements
- Bug fixes

**Optional "Full Changelog":**
- Everything else
- Link to Notion/Git for complete list

### 6. Generate Release Notes

#### Format: Customer-Facing (Default)

```markdown
# [Product Name] [Version] Release Notes
Released: [Date]

## 🎉 What's New

We're excited to share what's new in this release!

### [Feature Name]
[Brief description of the feature and its benefit]

**Highlights:**
- [Key point 1]
- [Key point 2]
- [Key point 3]

[Optional: Screenshot or GIF]

**Why this matters:** [Explain the value to users]

**How to use it:** [Brief usage instructions or link to docs]

---

### [Another Feature]
[Description...]

## ✨ Improvements

We've made [Product] faster and more reliable:

- **[Area]:** [Improvement description] – [Benefit]
- **[Area]:** [Improvement description] – [Benefit]
- **[Area]:** [Improvement description] – [Benefit]

## 🐛 Bug Fixes

We've squashed some bugs:

- Fixed issue where [problem] – [What's better now]
- Resolved [problem] – [What's better now]
- Corrected [problem] – [What's better now]

## ⚠️ Breaking Changes

[Only if applicable]

If you're using [feature], you'll need to:
1. [Action required]
2. [Action required]

[Link to migration guide]

## 🔜 Coming Soon

Here's a sneak peek at what we're working on:
- [Upcoming feature 1]
- [Upcoming feature 2]

[Link to roadmap]

## 📚 Resources

- [Documentation](link)
- [Video Tutorial](link)
- [Migration Guide](link) (if applicable)
- [Known Issues](link)

## 💬 Feedback

We'd love to hear what you think! [Link to feedback form/community]

---

**Full Changelog:** [Link to Notion or Git]
```

#### Format: Internal Team

```markdown
# Release [Version] – [Date]
Sprint [N] / [Release Name]

## 📊 Release Stats
- Items Completed: [N]
- Story Points: [N]
- Bug Fixes: [N]
- Team Velocity: [N]

## 🎯 Goals Achieved
- [OKR or goal]: ✅ [Outcome]
- [OKR or goal]: ⏳ [In Progress]

## 🚀 Shipped Features

### [Feature] ([Priority])
- **Owner:** [Name]
- **Epic:** [Link]
- **Status:** ✅ Shipped to production
- **Impact:** [Metrics if available]

[Technical notes if relevant]

## 🐛 Bug Fixes

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| [Title] | P0 | ✅ Fixed | [Details] |
| [Title] | P1 | ✅ Fixed | [Details] |

## 📈 Metrics

**Before Release:**
- [Metric]: [value]

**After Release:**
- [Metric]: [value] ([change])

## 🔍 Post-Release Monitoring

Watch for:
- [ ] [Metric] stays stable
- [ ] No increase in error rate
- [ ] [Feature] adoption tracking

## 🚧 Known Issues

- [Issue]: [Workaround] (fix planned for [version])

## 👏 Kudos

Shoutout to:
- [Person] for [contribution]
- [Person] for [contribution]

## 📋 Next Sprint

Top priorities:
1. [Item]
2. [Item]
3. [Item]
```

#### Format: Technical Changelog

```markdown
# Changelog

## [Version] - YYYY-MM-DD

### Added
- Feature A: description ([#123](link))
- Feature B: description ([#124](link))

### Changed
- Modified X to Y ([#125](link))
- Updated Z ([#126](link))

### Deprecated
- Feature C will be removed in v3.0 ([#127](link))

### Removed
- Removed deprecated feature D ([#128](link))

### Fixed
- Bug in X ([#129](link))
- Issue with Y ([#130](link))

### Security
- Patched vulnerability in Z ([#131](link))

[Based on Keep a Changelog format]
```

### 7. Add Visuals (Optional)

Enhance release notes с:

**Screenshots**
- Before/after comparisons
- New UI elements
- Feature highlights

**GIFs/Videos**
- Feature demos
- Workflow examples

**Metrics Charts**
- Performance improvements
- Usage statistics

**Diagrams**
- Architecture changes
- Flow diagrams

### 8. Review & Edit

**Checklist:**
- [ ] All significant changes included
- [ ] User-friendly language (no jargon)
- [ ] Benefits clearly stated
- [ ] Breaking changes highlighted
- [ ] Migration steps provided (if needed)
- [ ] Links to documentation work
- [ ] Tone matches brand voice
- [ ] No confidential information
- [ ] Grammar/spelling checked
- [ ] Formatted consistently

### 9. Publish

**Distribution Channels:**

**Notion**
- Create page in "Release Notes" database
- Link from product roadmap
- Notify team in Slack/Teams

**Email**
- Send to customer mailing list
- Personalize greeting
- Include CTA (try new feature, give feedback)

**In-App**
- Changelog modal on login
- "What's New" section
- Feature announcements

**Blog Post**
- Expanded version с context
- SEO optimization
- Social media promotion

**Social Media**
- Twitter thread with highlights
- LinkedIn post
- Product Hunt announcement (for major releases)

## Templates by Audience

### For End Users (Non-Technical)

Focus on:
- What can they DO now
- Problems solved
- Improved experience
- Simple language

Avoid:
- Technical implementation
- Code references
- Jargon

### For Developers (API/SDK)

Include:
- Breaking changes prominently
- New endpoints/methods
- Deprecated features
- Code examples
- Migration guides
- Version compatibility

### For Stakeholders/Management

Highlight:
- Business impact
- Metrics improvements
- Strategic alignment
- Customer feedback addressed
- ROI

## Versioning Guidelines

**Semantic Versioning (SemVer):**
```
MAJOR.MINOR.PATCH (e.g., 2.5.1)

MAJOR: breaking changes
MINOR: new features (backwards compatible)
PATCH: bug fixes (backwards compatible)

Pre-release: 2.5.0-beta.1
Build metadata: 2.5.0+20250326
```

**Calendar Versioning:**
```
YYYY.MM.DD (e.g., 2025.03.26)
YYYY.MM (e.g., 2025.03)
```

**Named Releases:**
```
Sprint 23
Q4 2025 Release
Winter Update
```

## Examples

### Example 1: Major Feature Release

```markdown
# Acme App v2.0 – Mobile Redesign 🎉
Released: March 26, 2025

We've completely reimagined the mobile experience!

### New Modern Interface
Our app now features a clean, intuitive design that makes it easier than ever to [do main task].

**What's different:**
- Streamlined navigation – find what you need in 2 taps instead of 5
- Dark mode – easy on your eyes, especially at night
- Customizable dashboard – arrange widgets your way

[Screenshot]

**Try it now:** Open the app on your phone and explore!

### Offline Mode
Work without internet! Changes sync automatically when you're back online.

Perfect for:
- Commutes and flights
- Areas with spotty connection
- Saving mobile data

### 3x Faster Loading
We've optimized everything under the hood. The app now loads in under 2 seconds (previously 6+ seconds).

## Also in This Release

- **Quick Actions:** Long-press app icon for shortcuts
- **Biometric Login:** Face ID and fingerprint support
- **Export to PDF:** Save your data as PDF documents
- **12 Bug Fixes:** Including the issue where [popular bug]

## Coming Next

- Tablet optimization (April)
- Team collaboration features (May)

Questions? Check out our [updated documentation](link) or [contact support](link).
```

### Example 2: Bug Fix Release

```markdown
# Acme App v1.8.3 – Stability Update
Released: March 26, 2025

This release focuses on fixing issues and improving reliability.

## What's Fixed

- **Payment Processing:** Resolved issue where some transactions failed to complete (affected <1% of users)
- **Notifications:** Fixed bug where push notifications weren't delivered on Android 14
- **Sync:** Corrected sync error that occurred when using special characters in names
- **Performance:** Reduced memory usage by 15%

## Known Issues

We're aware of an issue where [problem]. We're working on a fix for the next release. **Workaround:** [temporary solution].

---

Thank you for your patience! As always, please [report any issues](link).
```

## Output

После генерации release notes, предоставьте:

1. **Release Notes Document**: formatted markdown
2. **Summary Stats**: # features, bugs, items included
3. **Distribution Plan**: где и как publish
4. **Review Checklist**: что проверить перед publish
5. **Notion Link**: если created in Notion

## Tips

1. **User First**: пишите для audience, не для себя
2. **Show Value**: каждый item отвечает на "so what?"
3. **Be Specific**: "30% faster" > "improved performance"
4. **Visual**: screenshots/GIFs > text walls
5. **Honest**: acknowledge issues и limitations
6. **Actionable**: tell users что делать next
7. **Consistent**: одинаковый format каждый release
8. **Timely**: publish сразу после deploy
9. **Accessible**: easy to find (email, app, website)
10. **Celebrate**: release notes - это marketing opportunity!

Release notes - это conversation с users. Make them valuable, clear, and engaging!
