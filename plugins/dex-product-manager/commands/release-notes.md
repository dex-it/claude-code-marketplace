---
name: release-notes
description: Генерация release notes на основе завершённых items
---

# Release Notes Command

Автоматическая генерация release notes из завершённых features, improvements и bug fixes.

## Процесс

### 1. Define Scope

**Required:**
- Version/Sprint (e.g., "v2.5.0", "Sprint 23")
- Date Range

**Optional:**
- Release Name
- Audience (internal/customers/public)
- Format (markdown/Notion/email)

**Defaults:** Last sprint (2 weeks), customers, markdown

### 2. Fetch Items

**From Notion:**
- Status: Done/Shipped/Released
- Date Range: specified period
- Exclude: internal tasks, tech debt (unless major)

**From Git (alternative):**
```bash
git log --oneline v2.4.0..HEAD --grep="^feat:" --grep="^fix:"
```

### 3. Categorize

**Standard:**
- 🎉 New Features
- ✨ Improvements
- 🐛 Bug Fixes
- ⚡ Performance
- 🔒 Security
- ⚠️ Breaking Changes

**Custom:** By product area (Mobile, Desktop, Integrations, etc.)

### 4. Transform Language

**Technical → User-Friendly:**
```
Before: "Refactored auth service to use JWT"
After:  "Improved login security with industry-standard authentication"

Before: "Optimized SQL queries in dashboard"
After:  "Faster dashboard loading times"
```

**Guidelines:**
1. Focus on benefit, not technical details
2. Active voice ("You can now...")
3. Explain "so what"
4. Remove jargon
5. Be specific but concise

### 5. Prioritize

**Highlight:** Major features, frequently requested, critical fixes
**Standard:** Regular items
**Optional:** Full changelog link

### 6. Generate Notes

#### Customer-Facing (Default)

```markdown
# [Product] [Version] Release Notes
Released: [Date]

## 🎉 What's New

### [Feature Name]
[Description of benefit]

**Highlights:**
- [Key point 1]
- [Key point 2]

**Why this matters:** [Value explanation]
**How to use:** [Brief guide or doc link]

## ✨ Improvements
- **[Area]:** [Description] – [Benefit]

## 🐛 Bug Fixes
- Fixed [problem] – [What's better now]

## ⚠️ Breaking Changes
[If applicable]
Action required:
1. [Step]
2. [Step]

## 🔜 Coming Soon
- [Sneak peek]

## 📚 Resources
- [Docs](link)
- [Tutorial](link)

---
**Full Changelog:** [Link]
```

#### Internal Team

```markdown
# Release [Version] – [Date]

## 📊 Stats
- Items: [N], Story Points: [N], Velocity: [N]

## 🎯 Goals
- [OKR]: ✅/⏳ [Outcome]

## 🚀 Shipped
### [Feature] ([Priority])
- Owner: [Name]
- Epic: [Link]
- Impact: [Metrics]

## 🐛 Fixes
| Issue | Severity | Status |
|-------|----------|--------|
| [Title] | P0 | ✅ |

## 📈 Metrics
Before: [metric] = [value]
After:  [metric] = [value] ([change])

## 👏 Kudos
- [Person] for [contribution]

## 📋 Next Sprint
1. [Priority item]
```

#### Technical Changelog

```markdown
# Changelog

## [Version] - YYYY-MM-DD

### Added
- [Feature] ([#123](link))

### Changed
- [Modification] ([#124](link))

### Fixed
- [Bug fix] ([#125](link))

### Security
- [Security patch] ([#126](link))
```

### 7. Enhance (Optional)

**Visuals:**
- Screenshots (before/after)
- GIFs/videos
- Metric charts
- Diagrams

### 8. Review Checklist

- [ ] All significant changes included
- [ ] User-friendly language
- [ ] Benefits clear
- [ ] Breaking changes highlighted
- [ ] Migration steps (if needed)
- [ ] Links work
- [ ] Tone matches brand
- [ ] No confidential info
- [ ] Grammar checked

### 9. Publish

**Channels:**
- Notion: product database
- Email: customer list
- In-App: changelog modal
- Blog: expanded version
- Social: highlights thread

## Templates by Audience

### End Users
Focus: What can they DO, problems solved, simple language
Avoid: Technical details, jargon, code

### Developers (API)
Include: Breaking changes, new endpoints, deprecations, migration guides, examples

### Stakeholders
Highlight: Business impact, metrics, strategic alignment, ROI

## Versioning

**SemVer:** MAJOR.MINOR.PATCH (2.5.1)
- MAJOR: breaking changes
- MINOR: new features
- PATCH: bug fixes

**CalVer:** YYYY.MM.DD or YYYY.MM

**Named:** Sprint 23, Q4 2025, Winter Update

## Examples

### Major Release

```markdown
# App v2.0 – Mobile Redesign 🎉
Released: March 26, 2025

We've reimagined mobile!

### New Modern Interface
Clean, intuitive design for easier [main task].

**What's different:**
- Streamlined navigation (2 taps vs 5)
- Dark mode
- Customizable dashboard

### Offline Mode
Work without internet. Syncs automatically.

Perfect for: commutes, flights, spotty areas

### 3x Faster Loading
Under 2 seconds (was 6+)

## Also in This Release
- Quick Actions shortcuts
- Biometric login
- Export to PDF
- 12 bug fixes

## Coming Next
- Tablet optimization (April)
- Team features (May)
```

### Bug Fix Release

```markdown
# App v1.8.3 – Stability Update
Released: March 26, 2025

Fixes and reliability improvements.

## What's Fixed
- **Payments:** Resolved transaction failures
- **Notifications:** Fixed Android 14 delivery
- **Sync:** Special characters now work
- **Performance:** 15% less memory

## Known Issues
[Problem] – fix in next release
**Workaround:** [solution]
```

## Output

Provide:
1. **Release Notes** (formatted markdown)
2. **Stats** (# features, bugs, items)
3. **Distribution Plan**
4. **Review Checklist**
5. **Notion Link** (if created)

## Tips

1. **User First** – write for audience
2. **Show Value** – answer "so what?"
3. **Be Specific** – "30% faster" > "improved"
4. **Visual** – screenshots > text
5. **Honest** – acknowledge issues
6. **Actionable** – tell users next steps
7. **Consistent** – same format each time
8. **Timely** – publish right after deploy
9. **Accessible** – easy to find
10. **Celebrate** – marketing opportunity!

Release notes are conversations with users. Make them valuable, clear, engaging!
