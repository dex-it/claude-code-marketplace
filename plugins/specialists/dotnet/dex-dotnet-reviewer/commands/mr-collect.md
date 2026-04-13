---
description: Сбор данных MR/PR (review comments + commits + correlation) в файл для последующего ручного анализа. Платформы -- GitLab через glab api, GitHub через gh api.
user-invocable: true
allowed-tools: Bash, Write
argument-hint: "<MR-url или short-id>"
---

# /mr-collect

Собирает сырые данные живого MR / PR в один markdown-файл для последующего анализа (обобщение в ловушки skills делается отдельно, командой эта часть не покрывается).

**Goal:** Один файл с metadata + review comments от не-авторов + commits автора после первого ревью + сырое сопоставление «комментарий → коммиты, тронувшие тот же файл после даты комментария». Stdout -- только абсолютный путь.

**Input forms:**

- GitLab URL: `https://gitlab.<host>/<group>/<project>/-/merge_requests/<id>`
- GitHub URL: `https://github.com/<owner>/<repo>/pull/<number>`
- Short: `<owner>/<repo>#<number>` (GitHub) или `<group>/<project>!<id>` (GitLab)

**Platform detection:** по URL (`gitlab` / `github`) или по символу (`#` → GitHub, `!` → GitLab). Неизвестный формат -- явная ошибка с примерами.

**Data source:**

- GitLab: `glab api projects/:id/merge_requests/:iid`, `/notes`, `/discussions`, `/commits`
- GitHub: `gh api repos/:o/:r/pulls/:n`, `/comments` (review comments), `/issues/:n/comments` (issue-level), `/commits`

**Filters:**

- Review comments -- только от `author != MR author`, исключить bot-аккаунты (`*[bot]`, `gitlab-bot`, `dependabot`, `github-actions`)
- Commits -- только после даты первого review comment (иначе попадает вся история MR до ревью)

**Output file:** `/tmp/mr-collect-<platform>-<project-slug>-<mr-number>-<YYYYMMDD-HHMM>.md`. Слэши и спецсимволы в project slug заменить на `-`.

**Output structure (внутри файла):**

```
# MR Collect: <project> !<mr>
## Metadata            — таблица project / mr / title / author / source→target / status / created / merged
## Review Comments (N) — каждый: author, file:line, status, date, текст, replies
## Commits after first review (M) — каждый: sha, date, message, files, diff stat (+added -removed)
## Correlation hints   — для каждого comment: список коммитов, тронувших тот же файл после даты коммента
```

**Stdout:** одна строка -- абсолютный путь к созданному файлу. Без саммари, без обобщений.

**Constraints:**

- Без анализа, классификации, обобщения, маппинга на skills -- чистый сбор
- Сохранять имена проекта, файлов, авторов as-is -- файл для последующей обработки
- Авторизация CLI -- предполагается готовой

**Errors:**

- Не распознан формат ID → показать примеры форматов и выйти
- `glab auth status` / `gh auth status` падает → показать команды `glab auth login` / `gh auth login`
- MR/PR не найден или нет доступа → raw stderr CLI
- Нет review comments -- файл всё равно создаётся, секция `Review Comments` содержит `none`
