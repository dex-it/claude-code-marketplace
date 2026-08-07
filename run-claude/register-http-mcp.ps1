# Регистрация HTTP MCP-серверов (Confluence, Jira, произвольный) в Claude Code.
# Зеркало register-http-mcp.sh для Windows; вынесено из run-claude/run-claude.ps1.
param(
    [ValidateSet('local', 'user', 'project')]
    # По умолчанию user: CONFLUENCE_MCP_* и JIRA_MCP_* объявлены глобальными (README.md),
    # запись в ~/.claude.json не зависит от рабочего каталога и не кладёт токен внутрь репозитория.
    [string]$Scope = 'user',
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

# Write-Error при $ErrorActionPreference = 'Stop' терминирующий: следующий за ним exit N
# не выполняется, и наружу всегда уходит 1. Пишем в stderr сами, чтобы коды не терялись.
function Write-Err([string]$Message) {
    [Console]::Error.WriteLine($Message)
}

if ($Help) {
    Write-Host @'
Использование: .\register-http-mcp.ps1 [параметры]

Регистрирует HTTP MCP-серверы командой `claude mcp add --transport http` с заголовком Authorization.

Без -Name/-Url берёт пары переменных окружения:
  conflu <- CONFLUENCE_MCP_URL + CONFLUENCE_MCP_TOKEN
  jira   <- JIRA_MCP_URL + JIRA_MCP_TOKEN
Пара, у которой задан только URL или только токен, считается ошибкой; полностью пустая - пропускается.

Значения берутся из окружения; если рядом со скриптом лежит .env, он подгружается автоматически.

Области конфигурации:
  user     запись в ~/.claude.json, видна во всех проектах, от рабочего каталога не зависит;
  project  запись в .mcp.json корня проекта (каталог над этим скриптом) - файл лежит внутри
           репозитория, добавьте .mcp.json в .gitignore проекта;
  local    приватная запись для этого проекта, тоже привязана к корню проекта.

Токен Claude Code хранит открытым текстом в любой области - в ~/.claude.json или в .mcp.json;
у project к этому добавляется то, что файл лежит внутри репозитория. Переданный через -Token
он виден ещё и в списке процессов, поэтому надёжнее держать его в .env, в том числе
подвыражением вида TOKEN=$(Get-Secret -Name <имя> -AsPlainText).

Параметры:
  -Scope <local|user|project>  Область конфигурации (по умолчанию: user)
  -EnvFile <path>              Взять переменные из этого файла вместо соседнего .env
  -Name <name>                 Зарегистрировать один произвольный сервер под этим именем
  -Url <url>                   URL произвольного сервера
  -Token <token>               Токен произвольного сервера (без него заголовок не отправляется)
  -AuthScheme <scheme>         Схема в заголовке Authorization (по умолчанию: Token; часто Bearer)
  -Force                       Перерегистрировать серверы, которые уже есть
  -DryRun                      Показать команды (токены скрыты) и выйти
  -Help                        Эта справка

Примеры:
  .\register-http-mcp.ps1 -Scope project
  .\register-http-mcp.ps1 -Name gitlab -Url https://gitlab.com/api/v4/mcp
  .\register-http-mcp.ps1 -Name sentry -Url https://mcp.sentry.dev/mcp -Token $env:SENTRY_TOKEN -AuthScheme Bearer
'@
    exit 0
}

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Err 'ОШИБКА: claude не найден в PATH.'
    exit 1
}

if (-not $EnvFile -and (Test-Path (Join-Path $PSScriptRoot '.env'))) {
    $EnvFile = Join-Path $PSScriptRoot '.env'
}

if ($EnvFile) {
    if (-not (Test-Path $EnvFile)) {
        Write-Err "ОШИБКА: файл не найден: $EnvFile"
        exit 1
    }
    Write-Host "Переменные из: $EnvFile"
    # -Encoding UTF8 обязателен: на Windows PowerShell 5.1 дефолт Get-Content - ANSI-кодовая
    # страница системы, и не-ASCII значения приезжают искажёнными. Лаунчер читает так же.
    foreach ($line in Get-Content $EnvFile -Encoding UTF8) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#') -or ($trimmed -notmatch '=')) { continue }
        $key = $trimmed.Split('=', 2)[0].Trim()
        $value = $trimmed.Split('=', 2)[1].Trim()
        # Обрамляющие кавычки снимаем, как это делает bash-зеркало.
        if ($value.Length -ge 2) {
            if (($value[0] -eq '"' -and $value[-1] -eq '"') -or ($value[0] -eq "'" -and $value[-1] -eq "'")) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }
        # Секрет из менеджера: SOME_TOKEN=$(Get-Secret -Name <имя> -AsPlainText). Тот же способ
        # и та же граница доверия, что у лаунчера - .env локальный, untracked, с правами пользователя.
        if ($value -match '^\$\(.*\)$') { $value = Invoke-Expression $value }
        # Пустое значение пропускаем: оно затёрло бы переменную, заданную в окружении.
        if (-not $key -or -not $value) { continue }
        Set-Item -Path "env:$key" -Value $value
    }
}

$targets = @()

if ($Name -or $Url) {
    if (-not $Name -or -not $Url) {
        Write-Err 'ОШИБКА: -Name и -Url задаются вместе.'
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
            Write-Err "ОШИБКА: $serverName - задан $($pair.Prefix)_TOKEN, но не $($pair.Prefix)_URL."
            exit 1
        }
        if (-not $tokenValue) {
            Write-Err "ОШИБКА: $serverName - задан $($pair.Prefix)_URL, но не $($pair.Prefix)_TOKEN."
            exit 1
        }
        $targets += [pscustomobject]@{ Name = $serverName; Url = $urlValue; Token = $tokenValue }
    }
}

if ($targets.Count -eq 0) {
    Write-Err 'Нечего регистрировать: ни одной пары URL + токен. Подробности - .\register-http-mcp.ps1 -Help'
    exit 1
}

# project и local привязаны к рабочему каталогу: claude mcp add пишет .mcp.json туда,
# откуда его позвали. Лаунчер стартует claude из корня проекта (run-claude.ps1), поэтому
# запись должна лечь там же, а не в run-claude\, откуда запускают этот скрипт.
# Get-Item.FullName, а не Resolve-Path: у Resolve-Path на UNC-пути (сетевая шара, \\wsl.localhost)
# остаётся неразвёрнутый '..' и добавляется префикс провайдера.
$projectRoot = (Get-Item (Join-Path $PSScriptRoot '..')).FullName
if ($Scope -ne 'user') {
    Set-Location $projectRoot
    if ($DryRun) {
        Write-Host "Область ${Scope}: запись пошла бы в корень проекта $projectRoot"
    }
    elseif ($Scope -eq 'project') {
        Write-Host "Область project: запись ляжет в $(Join-Path $projectRoot '.mcp.json')"
        Write-Host 'ВНИМАНИЕ: файл лежит внутри репозитория и токен в нём открытым текстом - добавьте .mcp.json в .gitignore.'
    }
    else {
        Write-Host "Область local: запись привязана к проекту $projectRoot"
    }
}

$registered = 0
$failed = 0
$skipped = 0

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

    # claude mcp get находит сервер в любой видимой области, а claude mcp remove работает
    # строго в своей: без сверки области -Force падал бы на remove. Область берём из строки
    # "Scope:" вывода get; неузнанный формат считаем совпадением - это прежнее поведение.
    $getOut = (& claude mcp get $target.Name 2>$null | Out-String)
    $existingScope = ''
    if ($LASTEXITCODE -eq 0) {
        if ($getOut -match 'Scope:\s*User config') { $existingScope = 'user' }
        elseif ($getOut -match 'Scope:\s*Project config') { $existingScope = 'project' }
        elseif ($getOut -match 'Scope:\s*Local config') { $existingScope = 'local' }
        else { $existingScope = $Scope }
    }

    if ($existingScope -and $existingScope -ne $Scope) {
        Write-Err "ОШИБКА: сервер '$($target.Name)' уже зарегистрирован в области $existingScope, а регистрируем в $Scope."
        Write-Err "        Уберите его командой: claude mcp remove $($target.Name) --scope $existingScope"
        $failed++
        continue
    }

    if ($existingScope) {
        if ($Force) {
            Write-Host "Сервер '$($target.Name)' уже зарегистрирован в области $Scope - удаляю перед перерегистрацией."
            claude mcp remove $target.Name --scope $Scope
            if ($LASTEXITCODE -ne 0) {
                Write-Err "ОШИБКА: не удалось удалить '$($target.Name)' из области $Scope."
                $failed++
                continue
            }
        }
        else {
            Write-Err "Пропущен $($target.Name): уже зарегистрирован в области $Scope. Перерегистрация: -Force."
            $skipped++
            continue
        }
    }

    Write-Host "Регистрируем $($target.Name): $($target.Url)"
    if ($target.Token) {
        claude mcp add --transport http $target.Name --scope $Scope $target.Url --header "Authorization: $AuthScheme $($target.Token)"
    }
    else {
        claude mcp add --transport http $target.Name --scope $Scope $target.Url
    }
    # $ErrorActionPreference = 'Stop' на нативные команды не действует
    # ($PSNativeCommandUseErrorActionPreference по умолчанию $false), поэтому код проверяем сами.
    if ($LASTEXITCODE -eq 0) {
        $registered++
    }
    else {
        Write-Err "ОШИБКА: регистрация '$($target.Name)' не удалась."
        $failed++
    }
}

if ($DryRun) { exit 0 }

Write-Host ''
Write-Host "Зарегистрировано серверов: $registered (scope: $Scope)."
if ($skipped -gt 0) { Write-Host "Пропущено (уже есть): $skipped." }
if ($failed -gt 0) { Write-Host "С ошибкой: $failed." }
Write-Host 'Проверка: claude mcp list'

if ($failed -gt 0 -or $skipped -gt 0) { exit 1 }
