@echo off
REM Загружает переменные из .env в текущую сессию cmd
REM НЕ сохраняет их навсегда — только для этой сессии
REM Поддерживает дефолтные ключи через CLAUDE_ARGS в .env

if not exist ".env" (
    echo ERROR: Файл .env не найден!
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

echo Добавляем глобальные jira + conflu MCP.

rem # Add a user server
claude mcp add --transport http conflu --scope user https://confluence.mcp.dex-it.ru --header "Authorization: Token %CONFLUENCE_MCP_TOKEN%"
claude mcp add --transport http jira --scope user https://jira.mcp.dex-it.ru --header "Authorization: Token %JIRA_MCP_TOKEN%"

echo Запускаем claude
cd..

rem # Комбинируем дефолтные ключи с ключами пользователя
if "!CLAUDE_ARGS!"=="" (
    claude %*
) else (
    claude !CLAUDE_ARGS! %*
)

pause