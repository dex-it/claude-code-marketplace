@echo off
REM Загружает переменные из .env в текущую сессию cmd
REM НЕ сохраняет их навсегда — только для этой сессии
REM Поддерживает дефолтные ключи через CLAUDE_ARGS в .env

if not exist ".env" (
    echo ERROR: Файл .env не найден!
    pause
    exit /b 1
)

setlocal enabledelayedexpansion
set "CLAUDE_ARGS="

for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    if "%%a" neq "" if "%%b" neq "" (
        set "%%a=%%b"
        if "%%a"=="CLAUDE_ARGS" (
            set "CLAUDE_ARGS=%%b"
        )
        echo Установлена переменная: %%a
    )
)

echo Регистрируем MCP серверы...

rem # Confluence MCP (если URL задан)
if not "%CONFLUENCE_MCP_URL%"=="" (
    if not "%CONFLUENCE_MCP_TOKEN%"=="" (
        claude mcp add --transport http conflu --scope user %CONFLUENCE_MCP_URL% --header "Authorization: Token %CONFLUENCE_MCP_TOKEN%"
        echo [OK] Confluence MCP зарегистрирован: %CONFLUENCE_MCP_URL%
    ) else (
        echo [SKIP] Confluence MCP пропущен: токен CONFLUENCE_MCP_TOKEN не заполнен
    )
) else (
    echo [SKIP] Confluence MCP пропущен: URL CONFLUENCE_MCP_URL не заполнен
)

rem # Jira MCP (если URL задан)
if not "%JIRA_MCP_URL%"=="" (
    if not "%JIRA_MCP_TOKEN%"=="" (
        claude mcp add --transport http jira --scope user %JIRA_MCP_URL% --header "Authorization: Token %JIRA_MCP_TOKEN%"
        echo [OK] Jira MCP зарегистрирован: %JIRA_MCP_URL%
    ) else (
        echo [SKIP] Jira MCP пропущен: токен JIRA_MCP_TOKEN не заполнен
    )
) else (
    echo [SKIP] Jira MCP пропущен: URL JIRA_MCP_URL не заполнен
)

echo Запускаем claude
cd..

rem # Комбинируем дефолтные ключи с ключами пользователя
if "!CLAUDE_ARGS!"=="" (
    claude %*
) else (
    claude !CLAUDE_ARGS! %*
)

pause