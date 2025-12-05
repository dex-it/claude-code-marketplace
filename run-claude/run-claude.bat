@echo off
REM Загружает переменные из .env в текущую сессию cmd
REM НЕ сохраняет их навсегда — только для этой сессии
REM Поддерживает дефолтные ключи через CLAUDE_ARGS в .env
REM Загружает системный промпт из файла run-claude/system-prompt.md

if not exist ".env" (
    echo ERROR: Файл .env не найден!
    pause
    exit /b 1
)

setlocal enabledelayedexpansion
set "CLAUDE_ARGS="
set "SYSTEM_PROMPT_TEXT="

for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    if "%%a" neq "" if "%%b" neq "" (
        set "%%a=%%b"
        if "%%a"=="CLAUDE_ARGS" (
            set "CLAUDE_ARGS=%%b"
        )
        echo Установлена переменная: %%a
    )
)

REM ====== Загрузка системного промпта из файла ======
set "SYSTEM_PROMPT_FILE=.\system-prompt.md"
if exist "%SYSTEM_PROMPT_FILE%" (
    echo.
    echo [INFO] Загружаем системный промпт из %SYSTEM_PROMPT_FILE%

    REM Читаем весь файл в одну переменную
    setlocal disabledelayedexpansion
    for /f "usebackq delims=" %%i in ("%SYSTEM_PROMPT_FILE%") do (
        setlocal enabledelayedexpansion
        if not defined SYSTEM_PROMPT_TEXT (
            set "SYSTEM_PROMPT_TEXT=%%i"
        ) else (
            set "SYSTEM_PROMPT_TEXT=!SYSTEM_PROMPT_TEXT! %%i"
        )
        setlocal disabledelayedexpansion
    )
    setlocal enabledelayedexpansion
    echo [OK] Промпт загружен успешно
) else (
    echo [WARN] Файл %SYSTEM_PROMPT_FILE% не найден - будет использован стандартный промпт
)

echo.
echo ======================================
echo Регистрируем MCP серверы...
echo ======================================

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

echo.
echo ======================================
echo Запускаем Claude Code
echo ======================================
echo.

cd..

REM ====== Комбинируем промпт из файла + CLAUDE_ARGS ======
if defined SYSTEM_PROMPT_TEXT (
    set "FINAL_ARGS=!CLAUDE_ARGS! --append-system-prompt "!SYSTEM_PROMPT_TEXT!""
) else (
    set "FINAL_ARGS=!CLAUDE_ARGS!"
)

rem # Запускаем Claude с финальными аргументами
if "!FINAL_ARGS!"=="" (
    claude %*
) else (
    claude !FINAL_ARGS! %*
)

pause