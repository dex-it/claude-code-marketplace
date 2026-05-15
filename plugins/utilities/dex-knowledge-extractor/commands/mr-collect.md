---
description: Сбор данных MR/PR (атомарные findings + commits + correlation) в файл для последующего анализа. Платформы -- GitLab через glab api, GitHub через gh api.
user-invocable: true
allowed-tools: Bash, Write
argument-hint: "<MR-url или short-id> [--task <TASK-KEY>] [--trusted <user1,user2,...>]"
---

# /mr-collect

Собирает сырые данные живого MR / PR в один markdown-файл для последующего анализа (обобщение в ловушки skills делается отдельно командой `/mr-analyze`).

**Goal:** Один файл с metadata + плоским списком атомарных findings (ревью-комментарии не-авторов, структурированные AI-ревью-отчёты разбиты на отдельные находки) + commits автора после первого ревью + сырое сопоставление «находка → коммиты, тронувшие упомянутый файл». Stdout -- только абсолютный путь.

**Input forms:**

- GitLab URL: `https://gitlab.<host>/<group>/<project>/-/merge_requests/<id>`
- GitHub URL: `https://github.com/<owner>/<repo>/pull/<number>`
- Short: `<owner>/<repo>#<number>` (GitHub) или `<group>/<project>!<id>` (GitLab)
- Опциональный флаг `--task <TASK-KEY>` -- номер задачи для имени файла (например `DP-2255`)
- Опциональный флаг `--trusted <user1,user2,...>` -- список GitLab/GitHub usernames «опытных ревьюеров». Если передан, их комментарии помечаются тегом `[TRUSTED]` в выходе. Если не передан -- все комментарии без тегов, обработка как раньше.

**Platform detection:** по URL (`gitlab` / `github`) или по символу (`#` → GitHub, `!` → GitLab). Неизвестный формат -- явная ошибка с примерами.

**Data source:**

- GitLab: `glab api projects/:id/merge_requests/:iid`, `/notes`, `/discussions`, `/commits`
- GitHub: `gh api repos/:o/:r/pulls/:n`, `/comments` (review comments), `/issues/:n/comments` (issue-level), `/commits`

**Filters:**

- Review comments -- только от `author != MR author`, исключить bot-аккаунты (`*[bot]`, `gitlab-bot`, `dependabot`, `github-actions`)
- Commits -- только после даты первого review comment (иначе попадает вся история MR до ревью)
- Если `--trusted` пуст или не передан -- теги `[TRUSTED]` не добавляются, поле остаётся пустым

**Output file:** `/tmp/mr-collect-<task-key>-<platform>-<mr-number>-<YYYYMMDD-HHMM>.md`. Task key берётся из флага `--task`, иначе ищется в title / description MR по regex `[A-Z]{2,}-\d+`, иначе используется `no-task`. Слэши и спецсимволы в идентификаторах заменить на `-`.

**Output structure (внутри файла):**

```
# MR Collect: <project> !<mr>
## Metadata    — task / project / mr / title / author / source→target / status / created / merged
## Findings (N) — плоский список атомарных находок (формат ниже)
## Commits after first review (M) — sha, date, message, files, diff stat (+added -removed)
```

**Секция `## Findings`** — плоский список. Каждая находка:

```
### F<n>  [TRUSTED]?  severity=<CRITICAL|HIGH|MEDIUM|LOW|none>  source=review
- origin: Note <id> (<author>)
- file: <File.cs:NN | none>
- correlation: <sha, sha | none>
- text: <суть находки одной-двумя строками>
```

**Правило декомпозиции.** Структурированный AI-ревью-комментарий (маркеры `Pass 1`/`Pass 2`, секции `CRITICAL`/`HIGH`/`MEDIUM`/`LOW`, теги `[skill-name]`, `Score N/10`) — контейнер из нескольких находок: разбить по этим маркерам, каждый пункт = отдельный `### F<n>`. `file:line` для находки брать из её тела, если поле `file` GitLab-ноды пустое. Свободный комментарий человека без шаблона = один finding как есть. Привилегия `[TRUSTED]` распространяется на все под-находки контейнера.

**Поле `correlation`** — коммиты автора, тронувшие *любой* упомянутый в теле находки файл после даты исходного комментария (механическое сопоставление, без интерпретации). Один коммит может попасть в несколько находок.

**Stdout:** одна строка -- абсолютный путь к созданному файлу. Без саммари, без обобщений.

**Constraints:**

- Без анализа, классификации, обобщения, маппинга на skills -- чистый сбор
- Сохранять имена проекта, файлов, авторов as-is -- файл для последующей обработки
- Авторизация CLI -- предполагается готовой

**Errors:**

- Не распознан формат ID → показать примеры форматов и выйти
- `glab auth status` / `gh auth status` падает → показать команды `glab auth login` / `gh auth login`
- MR/PR не найден или нет доступа → raw stderr CLI
- Нет review comments -- файл всё равно создаётся, секция `Findings` содержит `none`
