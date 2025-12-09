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

if (-not (Test-Path ".env")) {
    Write-ErrorColor "ОШИБКА: Файл .env не найден!"
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

$SYSTEM_PROMPT_FILE = ".\system-prompt.md"
if (Test-Path $SYSTEM_PROMPT_FILE) {
    Write-Info "  Читаем файл: $SYSTEM_PROMPT_FILE"

    $SYSTEM_PROMPT_TEXT = (Get-Content $SYSTEM_PROMPT_FILE -Encoding UTF8 -Raw).Trim()

    Write-Success "  Промпт успешно загружен ($($SYSTEM_PROMPT_TEXT.Length) символов)"
}
else {
    Write-Warning "  Файл $SYSTEM_PROMPT_FILE не найден - используется стандартный промпт"
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
Write-Header "Запуск Claude Code"
Write-Header "======================================"
Write-Header ""

Set-Location ..

# Комбинируем промпт из файла + CLAUDE_ARGS
if ($SYSTEM_PROMPT_TEXT) {
    $FINAL_ARGS = "$CLAUDE_ARGS --append-system-prompt `"$SYSTEM_PROMPT_TEXT`""
    Write-Info "  Применяем кастомный системный промпт"
}
else {
    $FINAL_ARGS = $CLAUDE_ARGS
}

if ($FINAL_ARGS) {
    Write-Variable "  Аргументы: $FINAL_ARGS"
    Write-Host ""
}

# Запускаем Claude с финальными аргументами
if ([string]::IsNullOrWhiteSpace($FINAL_ARGS)) {
    claude @args
}
else {
    Invoke-Expression "claude $FINAL_ARGS $args"
}

Write-Host ""
Read-Host "Нажмите Enter для выхода"
