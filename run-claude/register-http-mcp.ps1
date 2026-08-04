# Регистрация HTTP MCP-серверов (Confluence, Jira, произвольный) в Claude Code.
# Зеркало register-http-mcp.sh для Windows; вынесено из run-claude/run-claude.ps1.
param(
    [ValidateSet('local', 'user', 'project')]
    [string]$Scope = 'project',
    [string]$EnvFile = '',
    [string]$Name = '',
    [string]$Url = '',
    [string]$Token = '',
    [string]$AuthScheme = 'Token',
    [switch]$Force,
    [switch]$DryRun,
    [switch]$Help
)

$ErrorActionPreference = 'Stop'

if ($Help) {
    Write-Host @'
Использование: .\register-http-mcp.ps1 [параметры]

Регистрирует HTTP MCP-серверы командой `claude mcp add --transport http` с заголовком Authorization.

Без -Name/-Url берёт пары переменных окружения:
  conflu <- CONFLUENCE_MCP_URL + CONFLUENCE_MCP_TOKEN
  jira   <- JIRA_MCP_URL + JIRA_MCP_TOKEN
Пара, у которой задан только URL или только токен, считается ошибкой; полностью пустая - пропускается.

Значения берутся из окружения; если рядом со скриптом лежит .env, он подгружается автоматически.

Параметры:
  -Scope <local|user|project>  Область конфигурации (по умолчанию: project)
  -EnvFile <path>              Взять переменные из этого файла вместо соседнего .env
  -Name <name>                 Зарегистрировать один произвольный сервер под этим именем
  -Url <url>                   URL произвольного сервера
  -Token <token>               Токен произвольного сервера (без него заголовок не отправляется)
  -AuthScheme <scheme>         Схема в заголовке Authorization (по умолчанию: Token; часто Bearer)
  -Force                       Перерегистрировать серверы, которые уже есть
  -DryRun                      Показать команды (токены скрыты) и выйти
  -Help                        Эта справка

Примеры:
  .\register-http-mcp.ps1 -Scope user
  .\register-http-mcp.ps1 -Name gitlab -Url https://gitlab.com/api/v4/mcp
  .\register-http-mcp.ps1 -Name sentry -Url https://mcp.sentry.dev/mcp -Token $env:SENTRY_TOKEN -AuthScheme Bearer
'@
    exit 0
}

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Error 'ОШИБКА: claude не найден в PATH.'
    exit 1
}

if (-not $EnvFile -and (Test-Path (Join-Path $PSScriptRoot '.env'))) {
    $EnvFile = Join-Path $PSScriptRoot '.env'
}

if ($EnvFile) {
    if (-not (Test-Path $EnvFile)) {
        Write-Error "ОШИБКА: файл не найден: $EnvFile"
        exit 1
    }
    Write-Host "Переменные из: $EnvFile"
    foreach ($line in Get-Content $EnvFile) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#') -or ($trimmed -notmatch '=')) { continue }
        $key = $trimmed.Split('=', 2)[0].Trim()
        $value = $trimmed.Split('=', 2)[1]
        # Пустое значение пропускаем: оно затёрло бы переменную, заданную в окружении.
        if (-not $key -or -not $value) { continue }
        Set-Item -Path "env:$key" -Value $value
    }
}

$targets = @()

if ($Name -or $Url) {
    if (-not $Name -or -not $Url) {
        Write-Error 'ОШИБКА: -Name и -Url задаются вместе.'
        exit 2
    }
    $targets += [pscustomobject]@{ Name = $Name; Url = $Url; Token = $Token }
}
else {
    foreach ($pair in @(@{ Name = 'conflu'; Prefix = 'CONFLUENCE_MCP' }, @{ Name = 'jira'; Prefix = 'JIRA_MCP' })) {
        $serverName = $pair.Name
        $urlValue = (Get-Item -Path "env:$($pair.Prefix)_URL" -ErrorAction SilentlyContinue).Value
        $tokenValue = (Get-Item -Path "env:$($pair.Prefix)_TOKEN" -ErrorAction SilentlyContinue).Value

        if (-not $urlValue -and -not $tokenValue) {
            Write-Host "Пропущен $serverName`: $($pair.Prefix)_URL и $($pair.Prefix)_TOKEN не заданы."
            continue
        }
        if (-not $urlValue) {
            Write-Error "ОШИБКА: $serverName - задан $($pair.Prefix)_TOKEN, но не $($pair.Prefix)_URL."
            exit 1
        }
        if (-not $tokenValue) {
            Write-Error "ОШИБКА: $serverName - задан $($pair.Prefix)_URL, но не $($pair.Prefix)_TOKEN."
            exit 1
        }
        $targets += [pscustomobject]@{ Name = $serverName; Url = $urlValue; Token = $tokenValue }
    }
}

if ($targets.Count -eq 0) {
    Write-Error 'Нечего регистрировать: ни одной пары URL + токен. Подробности - .\register-http-mcp.ps1 -Help'
    exit 1
}

$registered = 0

foreach ($target in $targets) {
    if ($DryRun) {
        if ($target.Token) {
            Write-Host "claude mcp add --transport http $($target.Name) --scope $Scope $($target.Url) --header `"Authorization: $AuthScheme ***`""
        }
        else {
            Write-Host "claude mcp add --transport http $($target.Name) --scope $Scope $($target.Url)"
        }
        continue
    }

    claude mcp get $target.Name *> $null
    if ($LASTEXITCODE -eq 0) {
        if ($Force) {
            Write-Host "Сервер '$($target.Name)' уже зарегистрирован - удаляю перед перерегистрацией."
            claude mcp remove $target.Name --scope $Scope
        }
        else {
            Write-Error "ОШИБКА: сервер '$($target.Name)' уже зарегистрирован. Перерегистрация: -Force."
            exit 1
        }
    }

    Write-Host "Регистрируем $($target.Name): $($target.Url)"
    if ($target.Token) {
        claude mcp add --transport http $target.Name --scope $Scope $target.Url --header "Authorization: $AuthScheme $($target.Token)"
    }
    else {
        claude mcp add --transport http $target.Name --scope $Scope $target.Url
    }
    $registered++
}

if ($DryRun) { exit 0 }

Write-Host ''
Write-Host "Зарегистрировано серверов: $registered (scope: $Scope)."
Write-Host 'Проверка: claude mcp list'
