# Загружает переменные из .env в текущую сессию PowerShell
# НЕ сохраняет их навсегда — только для этой сессии
# Поддерживает дефолтные ключи через CLAUDE_ARGS в .env
# Загружает системный промпт из файла system-prompt.md

# Функции для цветного вывода
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-ErrorColor { Write-Host $args -ForegroundColor Red }
function Write-Header { Write-Host $args -ForegroundColor Magenta }
function Write-Variable { Write-Host $args -ForegroundColor DarkGray }

# Показать help
if ($args -contains "--help" -or $args -contains "-h") {
    Write-Host ""
    Write-Header "======================================"
    Write-Header "🚀 Claude Code Launcher"
    Write-Header "======================================"
    Write-Host ""
    Write-Host "Использование: .\run-claude.ps1 [аргументы для Claude]"
    Write-Host ""
    Write-Host "Скрипт выполняет:"
    Write-Host "  1. Загружает переменные из .env файла"
    Write-Host "  2. Загружает системный промпт из system-prompt.md"
    Write-Host "  3. Регистрирует MCP серверы (Confluence, Jira)"
    Write-Host "  4. Запускает Claude Code с заданными параметрами"
    Write-Host ""
    Write-Host "Переменные окружения (.env):"
    Write-Host "  LOAD_SYSTEM_PROMPT       - загружать системный промпт (true/false, по умолчанию: true)"
    Write-Host "  CLAUDE_ARGS              - дефолтные аргументы для Claude"
    Write-Host "  CONFLUENCE_MCP_URL       - URL Confluence MCP сервера"
    Write-Host "  CONFLUENCE_MCP_TOKEN     - токен для Confluence MCP"
    Write-Host "  JIRA_MCP_URL             - URL Jira MCP сервера"
    Write-Host "  JIRA_MCP_TOKEN           - токен для Jira MCP"
    Write-Host ""
    Write-Host "Примеры:"
    Write-Host "  .\run-claude.ps1"
    Write-Host "  .\run-claude.ps1 /init"
    Write-Host "  .\run-claude.ps1 --model opus"
    Write-Host ""
    exit 0
}

# Проверка установки Claude CLI
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-ErrorColor "❌ ОШИБКА: Claude CLI не установлен!"
    Write-ErrorColor "Установите Claude Code: https://claude.ai/code"
    Read-Host "Нажмите Enter для выхода"
    exit 1
}

if (-not (Test-Path ".env")) {
    Write-ErrorColor "❌ ОШИБКА: Файл .env не найден!"
    Write-ErrorColor "Создайте файл .env на основе sample.env"
    Read-Host "Нажмите Enter для выхода"
    exit 1
}

$CLAUDE_ARGS = ""
$SYSTEM_PROMPT_TEXT = ""

Write-Header ""
Write-Header "======================================"
Write-Header "Загрузка переменных окружения"
Write-Header "======================================"
Write-Header ""

# Разбор .env
Get-Content ".env" -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) {
        return
    }

    if ($line -match '^([^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()

        Set-Item -Path "env:$key" -Value $value

        if ($key -eq "CLAUDE_ARGS") {
            $CLAUDE_ARGS = $value
        }

        Write-Variable "  Установлена переменная: $key"
    }
}

# Загрузка системного промпта из файла
Write-Header ""
Write-Header "======================================"
Write-Header "Загрузка системного промпта"
Write-Header "======================================"
Write-Header ""

# Проверяем значение LOAD_SYSTEM_PROMPT (по умолчанию true)
$loadPrompt = if ($env:LOAD_SYSTEM_PROMPT) { $env:LOAD_SYSTEM_PROMPT } else { "true" }
if ($loadPrompt -eq "true") {
    $SYSTEM_PROMPT_FILE = ".\system-prompt.md"
    if (Test-Path $SYSTEM_PROMPT_FILE) {
        Write-Info "  Читаем файл: $SYSTEM_PROMPT_FILE"

        $SYSTEM_PROMPT_TEXT = (Get-Content $SYSTEM_PROMPT_FILE -Encoding UTF8 -Raw).Trim()

        Write-Success "  Промпт успешно загружен ($($SYSTEM_PROMPT_TEXT.Length) символов)"
    }
    else {
        Write-Warning "  Файл $SYSTEM_PROMPT_FILE не найден - используется стандартный промпт"
    }
}
else {
    Write-Warning "  Загрузка системного промпта отключена (LOAD_SYSTEM_PROMPT=false)"
}

Write-Header ""
Write-Header "======================================"
Write-Header "Регистрация MCP серверов"
Write-Header "======================================"
Write-Header ""

# Confluence MCP
if ($env:CONFLUENCE_MCP_URL -and $env:CONFLUENCE_MCP_TOKEN) {
    Write-Info "  Регистрируем Confluence MCP..."
    claude mcp add --transport http conflu --scope user $env:CONFLUENCE_MCP_URL --header "Authorization: Token $env:CONFLUENCE_MCP_TOKEN"
    Write-Success "  Confluence MCP зарегистрирован: $env:CONFLUENCE_MCP_URL"
}
elseif (-not $env:CONFLUENCE_MCP_URL) {
    Write-Warning "  Confluence MCP пропущен: URL не задан (CONFLUENCE_MCP_URL)"
}
else {
    Write-Warning "  Confluence MCP пропущен: токен не задан (CONFLUENCE_MCP_TOKEN)"
}

# Jira MCP
if ($env:JIRA_MCP_URL -and $env:JIRA_MCP_TOKEN) {
    Write-Info "  Регистрируем Jira MCP..."
    claude mcp add --transport http jira --scope user $env:JIRA_MCP_URL --header "Authorization: Token $env:JIRA_MCP_TOKEN"
    Write-Success "  Jira MCP зарегистрирован: $env:JIRA_MCP_URL"
}
elseif (-not $env:JIRA_MCP_URL) {
    Write-Warning "  Jira MCP пропущен: URL не задан (JIRA_MCP_URL)"
}
else {
    Write-Warning "  Jira MCP пропущен: токен не задан (JIRA_MCP_TOKEN)"
}

Write-Header ""
Write-Header "======================================"
Write-Header "🚀 Запуск Claude Code"
Write-Header "======================================"
Write-Header ""

try {
    Set-Location ..
}
catch {
    Write-ErrorColor "❌ ОШИБКА: Не удалось перейти в родительскую директорию"
    Read-Host "Нажмите Enter для выхода"
    exit 1
}

# Подготавливаем массив аргументов для безопасного вызова
$ClaudeCmdArgs = @()

# Добавляем CLAUDE_ARGS в массив (если есть)
if (-not [string]::IsNullOrWhiteSpace($CLAUDE_ARGS)) {
    # Разбиваем CLAUDE_ARGS на отдельные элементы
    $ArgArray = $CLAUDE_ARGS -split '\s+'
    $ClaudeCmdArgs += $ArgArray
    Write-Variable "  🔧 Дефолтные аргументы: $CLAUDE_ARGS"
}

# Добавляем системный промпт через --append-system-prompt (если есть)
if (-not [string]::IsNullOrWhiteSpace($SYSTEM_PROMPT_TEXT)) {
    $ClaudeCmdArgs += "--append-system-prompt"
    $ClaudeCmdArgs += $SYSTEM_PROMPT_TEXT
    Write-Info "  📌 Применяем кастомный системный промпт"
}

# Добавляем пользовательские аргументы
$ClaudeCmdArgs += $args

if ($ClaudeCmdArgs.Count -gt 0) {
    Write-Host ""
}

# Безопасный запуск Claude без Invoke-Expression
& claude $ClaudeCmdArgs

Write-Host ""
Read-Host "Нажмите Enter для выхода"
