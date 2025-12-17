# Руководство по настройке учётных данных

Это руководство объясняет, как настроить учётные данные для MCP-серверов (Model Context Protocol), используемых плагинами Claude Code Marketplace.

## Обзор

Плагины Claude Code используют MCP-серверы для интеграции с внешними сервисами. Каждый MCP-сервер требует определённые учётные данные, настроенные через переменные окружения.

**Конфигурация MCP серверов:** Все MCP серверы собраны в каталоге `mcp/mcp-template.json`. Скопируйте нужные серверы в свой `.mcp.json` и настройте переменные окружения ниже.

## Способы настройки учётных данных

### Рекомендуемый: Системные переменные окружения

**Лучшая практика** — задать переменные окружения в конфигурации вашей оболочки:

```bash
# Добавьте в ~/.bashrc, ~/.zshrc или аналогичный файл
export GITLAB_TOKEN="glpat-xxxxxxxxxxxxx"
export NOTION_API_KEY="ntn_xxxxxxxxxxxxx"
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxx"
export MLFLOW_TRACKING_URI="http://localhost:5000"
export WANDB_API_KEY="xxxxxxxxxxxxx"
export HUGGINGFACE_TOKEN="hf_xxxxxxxxxxxxx"
```

Затем перезагрузите оболочку:
```bash
source ~/.bashrc  # или ~/.zshrc
```

### Синтаксис переменных окружения в .mcp.json

Плагины используют два паттерна для переменных окружения:

1. **Обязательная переменная** — ошибка, если не задана:
   ```json
   "${VAR_NAME}"
   ```

2. **Опциональная со значением по умолчанию** — использует значение по умолчанию, если не задана:
   ```json
   "${VAR_NAME:-default_value}"
   ```

Пример:
```json
{
  "mcpServers": {
    "gitlab": {
      "command": "uvx",
      "args": ["mcp-server-gitlab"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "${GITLAB_TOKEN}",
        "GITLAB_API_URL": "${GITLAB_API_URL:-https://gitlab.com/api/v4}"
      }
    }
  }
}
```

## Настройка учётных данных сервисов

### GitLab

**Используется:** dex-devops, dex-dotnet-developer, dex-python-ml-developer, dex-quality-assurance, dex-dotnet-architect

**Обязательные переменные:**
- `GITLAB_TOKEN` — Personal Access Token

**Опциональные переменные:**
- `GITLAB_API_URL` — URL API GitLab (по умолчанию: `https://gitlab.com/api/v4`)

**Инструкция по настройке:**

1. Перейдите на https://gitlab.com/-/user_settings/personal_access_tokens
2. Нажмите "Add new token"
3. Имя токена: `Claude Code Marketplace`
4. Дата истечения: выберите подходящий срок
5. Выберите области доступа (scopes):
   - ✅ `api` — полный доступ к API
   - ✅ `read_repository` — чтение репозитория
   - ✅ `write_repository` — запись в репозиторий
6. Нажмите "Create personal access token"
7. Скопируйте токен (начинается с `glpat-`)
8. Задайте переменную окружения:
   ```bash
   export GITLAB_TOKEN="glpat-xxxxxxxxxxxxx"
   ```

**Для Self-Hosted GitLab:**
```bash
export GITLAB_API_URL="https://gitlab.yourcompany.com/api/v4"
```

---

### Notion

**Используется:** dex-product-manager, dex-dotnet-developer, dex-python-ml-developer, dex-system-analyst, dex-dotnet-architect

**Обязательные переменные:**
- `NOTION_TOKEN` — Internal Integration Token (рекомендуется)
- `NOTION_API_KEY` — поддерживается для обратной совместимости

**Инструкция по настройке:**

1. Перейдите на https://www.notion.so/my-integrations
2. Нажмите "Create New Integration"
3. Имя интеграции: `Claude Code Marketplace`
4. Рабочее пространство: выберите ваше пространство
5. Возможности: оставьте по умолчанию (Read content, Update content, Insert content)
6. Нажмите "Submit"
7. Скопируйте "Internal Integration Token" (начинается с `ntn_`)
8. Задайте переменную окружения:
   ```bash
   export NOTION_API_KEY="ntn_xxxxxxxxxxxxx"
   ```

**Важно:** Предоставьте интеграции доступ к страницам/базам данных:
1. Откройте нужную страницу Notion
2. Нажмите "Share" → "Invite"
3. Выберите вашу интеграцию из списка

---

### GitHub

**Используется:** dex-dotnet-architect

**Обязательные переменные:**
- `GITHUB_TOKEN` — Personal Access Token

**Инструкция по настройке:**

1. Перейдите на https://github.com/settings/tokens
2. Нажмите "Generate new token" → "Generate new token (classic)"
3. Имя токена: `Claude Code Marketplace`
4. Срок действия: выберите подходящий
5. Выберите области доступа (scopes):
   - ✅ `repo` — полный контроль приватных репозиториев
   - ✅ `read:org` — чтение данных организации
6. Нажмите "Generate token"
7. Скопируйте токен (начинается с `ghp_`)
8. Задайте переменную окружения:
   ```bash
   export GITHUB_TOKEN="ghp_xxxxxxxxxxxxx"
   ```

---

### MLflow

**Используется:** dex-python-ml-developer

**Обязательные переменные:**
- `MLFLOW_TRACKING_URI` — URL сервера отслеживания MLflow

**Инструкция по настройке:**

**Вариант 1: Локальный MLflow сервер**
```bash
# Установка MLflow
pip install mlflow

# Запуск tracking-сервера
mlflow server --host 0.0.0.0 --port 5000

# Задание переменной окружения
export MLFLOW_TRACKING_URI="http://localhost:5000"
```

**Вариант 2: Удалённый MLflow сервер**
```bash
export MLFLOW_TRACKING_URI="https://mlflow.yourcompany.com"
```

**Вариант 3: Databricks**
```bash
export MLFLOW_TRACKING_URI="databricks"
export DATABRICKS_HOST="https://yourworkspace.cloud.databricks.com"
export DATABRICKS_TOKEN="dapi_xxxxxxxxxxxxx"
```

---

### Weights & Biases

**Используется:** dex-python-ml-developer

**Обязательные переменные:**
- `WANDB_API_KEY` — API-ключ W&B

**Инструкция по настройке:**

1. Зарегистрируйтесь на https://wandb.ai
2. Перейдите на https://wandb.ai/authorize
3. Скопируйте ваш API-ключ
4. Задайте переменную окружения:
   ```bash
   export WANDB_API_KEY="xxxxxxxxxxxxx"
   ```

---

### HuggingFace

**Используется:** dex-python-ml-developer

**Обязательные переменные:**
- `HUGGINGFACE_TOKEN` или `HF_TOKEN` — API-токен HuggingFace

**Инструкция по настройке:**

1. Зарегистрируйтесь на https://huggingface.co
2. Перейдите на https://huggingface.co/settings/tokens
3. Нажмите "New token"
4. Имя токена: `Claude Code Marketplace`
5. Тип токена: выберите в зависимости от потребностей:
   - **Read** — скачивание моделей/датасетов
   - **Write** — загрузка моделей/датасетов
6. Нажмите "Generate token"
7. Скопируйте токен (начинается с `hf_`)
8. Задайте переменную окружения:
   ```bash
   export HUGGINGFACE_TOKEN="hf_xxxxxxxxxxxxx"
   # или
   export HF_TOKEN="hf_xxxxxxxxxxxxx"
   ```

---

### Supabase / PostgreSQL

**Используется:** dex-dotnet-developer (опционально)

**Обязательные переменные:**
- `SUPABASE_CONNECTION_STRING` — строка подключения PostgreSQL

**Инструкция по настройке:**

**Вариант 1: Supabase**
1. Зарегистрируйтесь на https://supabase.com
2. Создайте новый проект
3. Перейдите в Project Settings → Database
4. Скопируйте строку подключения (рекомендуется Pooler mode)
5. Задайте переменную окружения:
   ```bash
   export SUPABASE_CONNECTION_STRING="postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"
   ```

**Вариант 2: Self-Hosted PostgreSQL**
```bash
export SUPABASE_CONNECTION_STRING="postgresql://username:password@localhost:5432/dbname"
```

---

### Google Drive

**Используется:** dex-system-analyst

**Обязательные переменные:**
- `GOOGLE_DRIVE_OAUTH_CREDENTIALS` — путь к файлу OAuth credentials JSON

**Инструкция по настройке:**

1. Создайте проект в Google Cloud Console: https://console.cloud.google.com
2. Перейдите в APIs & Services → Library
3. Включите следующие APIs:
   - Google Drive API
   - Google Docs API
   - Google Sheets API
   - Google Slides API
4. Перейдите в APIs & Services → Credentials
5. Нажмите "Create Credentials" → "OAuth client ID"
6. Application type: выберите "Desktop app"
7. Имя: `Claude Code MCP`
8. Нажмите "Create"
9. Скачайте JSON файл (кнопка "Download JSON")
10. Сохраните файл в безопасное место:
    ```bash
    mkdir -p ~/.config/google-drive-mcp
    mv ~/Downloads/client_secret_*.json ~/.config/google-drive-mcp/oauth-credentials.json
    ```
11. Задайте переменную окружения:
    ```bash
    export GOOGLE_DRIVE_OAUTH_CREDENTIALS="$HOME/.config/google-drive-mcp/oauth-credentials.json"
    ```
12. При первом запуске откроется браузер для OAuth авторизации — войдите в Google аккаунт и разрешите доступ

**Примечание:** Токены сохраняются автоматически в `~/.config/google-drive-mcp/tokens.json` и обновляются при необходимости.

---

### PDF Reader

**Используется:** dex-system-analyst

**Обязательные переменные:** Нет

PDF Reader MCP не требует учётных данных. Работает с:
- Локальными файлами (абсолютные и относительные пути)
- HTTP/HTTPS URL

---

## Требования к учётным данным по плагинам

| Плагин | GitLab | Notion | GitHub | MLflow | W&B | HuggingFace | Supabase | Google Drive | PDF Reader |
|--------|--------|--------|--------|--------|-----|-------------|----------|--------------|------------|
| **dex-dotnet-developer** | ✅ | ✅ | - | - | - | - | 🔵 | - | - |
| **dex-dotnet-architect** | ✅ | ✅ | ✅ | - | - | - | - | - | - |
| **dex-python-ml-developer** | ✅ | ✅ | - | ✅ | ✅ | ✅ | - | - | - |
| **dex-product-manager** | - | ✅ | - | - | - | - | - | - | - |
| **dex-system-analyst** | - | ✅ | - | - | - | - | - | 🔵 | ✅ |
| **dex-quality-assurance** | ✅ | - | - | - | - | - | - | - | - |
| **dex-devops** | ✅ | - | - | - | - | - | - | - | - |

**Легенда:**
- ✅ Обязательно (или не требует credentials)
- 🔵 Опционально
- \- Не используется

## Лучшие практики безопасности

### ДЕЛАЙТЕ ✅

1. **Используйте переменные окружения** — никогда не храните учётные данные в файлах
2. **Устанавливайте срок действия** — задавайте дату истечения для всех токенов
3. **Минимум прав** — предоставляйте только необходимые разрешения
4. **Регулярно обновляйте токены** — периодически создавайте новые
5. **Используйте .gitignore** — убедитесь, что `.env` файлы игнорируются git
6. **Разделяйте окружения** — используйте разные токены для dev/staging/prod
7. **Храните надёжно** — используйте менеджеры паролей для хранения токенов

### НЕ ДЕЛАЙТЕ ❌

1. **Никогда не коммитьте токены** — не добавляйте учётные данные в репозиторий
2. **Не делитесь токенами** — каждый разработчик должен иметь свои
3. **Не используйте root-токены** — избегайте токенов с правами администратора
4. **Не пропускайте срок действия** — всегда устанавливайте дату истечения
5. **Не переиспользуйте токены** — используйте разные токены для разных целей
6. **Не хардкодьте** — никогда не записывайте учётные данные в .mcp.json файлы
7. **Не светите в логах** — будьте внимательны с отладочным выводом

## Проверка

После настройки учётных данных проверьте конфигурацию:

```bash
# Запустите Claude Code
claude

# Внутри Claude Code проверьте статус MCP-серверов
/mcp list

# Вы должны увидеть все настроенные MCP-серверы
```

Ожидаемый вывод:
```
✅ gitlab - Connected
✅ notion - Connected
✅ github - Connected
✅ mlflow - Connected
✅ wandb - Connected
✅ huggingface - Connected
```

## Устранение неполадок

### MCP-сервер не отображается

**Проблема:** MCP-сервер не появляется в `/mcp list`

**Решения:**
1. Убедитесь, что переменная окружения задана:
   ```bash
   echo $GITLAB_TOKEN
   ```
2. Перезапустите Claude Code после установки переменных
3. Проверьте файл `.mcp.json` плагина на правильность имён переменных

---

### Ошибки аутентификации

**Проблема:** Ошибки "401 Unauthorized" или "403 Forbidden"

**Решения:**
1. **Проверьте валидность токена:**
   - GitLab: `curl -H "PRIVATE-TOKEN: $GITLAB_TOKEN" https://gitlab.com/api/v4/user`
   - GitHub: `curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user`
   - Notion: Проверьте в Notion → Settings → Integrations
2. **Проверьте области доступа токена** — убедитесь, что нужные разрешения выданы
3. **Срок действия токена** — создайте новый токен, если старый истёк
4. **Лимиты API** — подождите, если превышен лимит запросов

---

### Проблемы с подстановкой переменных

**Проблема:** Переменные окружения не раскрываются в `.mcp.json`

**Известные проблемы:**
- GitHub Issue #9427: Подстановка переменных может не работать в `.mcp.json` плагина
- GitHub Issue #6204: HTTP-заголовки с `${VAR}` не работают
- GitHub Issue #11927: Переменные окружения из `.claude/settings.json` не передаются в MCP

**Обходной путь:**
Используйте системные переменные окружения (рекомендуется) вместо `.claude/settings.json`

---

### Интеграция Notion не работает

**Проблема:** Notion MCP не может получить доступ к страницам/базам данных

**Решения:**
1. **Предоставьте доступ страницам:**
   - Откройте страницу Notion → Share → Invite integration
2. **Проверьте разрешения интеграции:**
   - https://www.notion.so/my-integrations
   - Убедитесь, что включены возможности Read/Write/Insert
3. **Проверьте API-ключ:**
   ```bash
   echo $NOTION_API_KEY
   ```

---

### Ошибка подключения к MLflow

**Проблема:** Не удаётся подключиться к серверу отслеживания MLflow

**Решения:**
1. **Проверьте, что сервер запущен:**
   ```bash
   curl $MLFLOW_TRACKING_URI/health
   ```
2. **Проверьте формат URI:**
   - Локальный: `http://localhost:5000`
   - Удалённый: `https://mlflow.yourcompany.com`
   - Databricks: `databricks`
3. **Проверьте сеть/файрвол** — убедитесь, что порт MLflow доступен

---

### Аутентификация HuggingFace

**Проблема:** Не удаётся скачать/загрузить модели

**Решения:**
1. **Попробуйте оба имени переменных:**
   ```bash
   export HUGGINGFACE_TOKEN="hf_xxxxx"
   export HF_TOKEN="hf_xxxxx"
   ```
2. **Проверьте тип токена** — используйте "Write" токен для загрузки
3. **Проверьте токен:**
   ```bash
   huggingface-cli whoami
   ```

---

## Примеры настройки окружения

### Полная настройка для .NET разработки

```bash
# .bashrc или .zshrc
export GITLAB_TOKEN="glpat-xxxxxxxxxxxxx"
export NOTION_API_KEY="ntn_xxxxxxxxxxxxx"
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxx"

# Опционально: Supabase для доступа к базе данных
export SUPABASE_CONNECTION_STRING="postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"
```

### Настройка для Python ML разработки

```bash
# .bashrc или .zshrc
export GITLAB_TOKEN="glpat-xxxxxxxxxxxxx"
export NOTION_API_KEY="ntn_xxxxxxxxxxxxx"
export MLFLOW_TRACKING_URI="http://localhost:5000"
export WANDB_API_KEY="xxxxxxxxxxxxx"
export HUGGINGFACE_TOKEN="hf_xxxxxxxxxxxxx"
export HF_TOKEN="hf_xxxxxxxxxxxxx"
```

### Настройка для продакт-менеджмента

```bash
# .bashrc или .zshrc
export NOTION_API_KEY="ntn_xxxxxxxxxxxxx"
```

### Настройка для DevOps

```bash
# .bashrc или .zshrc
export GITLAB_TOKEN="glpat-xxxxxxxxxxxxx"
export GITLAB_API_URL="https://gitlab.yourcompany.com/api/v4"  # Если self-hosted
```

---

## Дополнительные ресурсы

- **Документация Claude Code:** https://github.com/anthropics/claude-code
- **Спецификация MCP Protocol:** https://spec.modelcontextprotocol.io
- **Документация GitLab API:** https://docs.gitlab.com/ee/api/
- **Документация Notion API:** https://developers.notion.com
- **Документация GitHub API:** https://docs.github.com/en/rest
- **MLflow Tracking:** https://mlflow.org/docs/latest/tracking.html
- **Weights & Biases:** https://docs.wandb.ai
- **HuggingFace Hub:** https://huggingface.co/docs/hub

---

## Получение помощи

Если вы столкнулись с проблемами, не описанными в этом руководстве:

1. **Проверьте README плагина** — каждый плагин имеет раздел устранения неполадок
2. **Проверьте учётные данные** — используйте curl/API-клиенты для прямой проверки токенов
3. **Проверьте логи MCP** — ищите сообщения об ошибках в выводе Claude Code
4. **GitHub Issues** — сообщайте о проблемах на https://github.com/anthropics/claude-code/issues

---

**Последнее обновление:** 2025-11-26
**Версия Marketplace:** 2.0.0
