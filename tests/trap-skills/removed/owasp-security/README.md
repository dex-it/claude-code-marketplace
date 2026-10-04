# [снят] owasp-security: сжатие по свидетельству, группа 1.1

Скилл `dex-skill-owasp-security` 1.3.2 ([`inputs/SKILL-1.3.2.md`](inputs/SKILL-1.3.2.md)), эпик
#291, группа 1.1 (#293). Итог - скилл снят целиком, строка в реестре [`tests/README.md`](../../../README.md).

Вход - общий мини-проект [`_projects/billing`](../../_projects/billing/README.md), кейсы S1, S2,
ключ там же; дополнительно E1, E0 набора [review-evidence](../../review-evidence/README.md) - кейсы
без owasp-дефектов. Исполнитель - `claude-sonnet-5-5` (алиас `sonnet`), effort не задан
(наследуется), субагент `general-purpose` без `Skill` tool; MCP сессии оператора доступны, не
предписаны. Сборка, тесты и dotnet разрешены. Прогоны `c` - контроль без скилла; со скиллом прогонов
нет: снятие по контролю.

S1 и S2 - общий контроль группы 1.1: те же прогоны засчитываются `performance-review`, `testability`,
`no-loose-ends`, `output-hygiene`; вердикты по ним - в их протоколах.

## Потребители

Skill tool в фазе: `mr-reviewer`, `mr-check-reviewer`, `self-reviewer` (ось `security`),
`security-reviewer` (всегда), `stand-reviewer`, `bug-finder`, `incident-investigator`,
`discover-reviewer`, `architect`, `architect-dotnet` (условно). Реестр `stack-registry` называл скилл
тематическим «всегда при эндпоинтах». Узлы dex-auto reviewer и skeptic - по суждению (P98). Бандлы:
`code-review`, `bug-lifecycle`, `architect`, `dotnet-developer`, `dotnet-fullstack`, `ts-fullstack`,
`system-analyst`, `qa-engineer`.

## Тип единиц

18 ловушек, все - ловушки; чек-лист повторяет их названиями. Процедур нет.

## Промпт

Общий с группой 0 ([fact-verification](../../fact-verification/README.md#заход-группы-0-звенья-каскада-2026-10-04)).
Описания MR:

- S1: «Личный кабинет клиента по задаче docs/tasks/BILL-21-portal.md: вход по email и паролю с JWT,
  свои счета, карточка счёта, документы счёта, профиль. Бэк-офис: заведение клиента с начальным
  паролем, загрузка документов к счёту. Демо-клиент для стенда фронта заводится при старте.»
- S2: «Печать счёта в HTML и PDF (wkhtmltopdf), заголовок печатной формы передаёт фронт; поиск счетов
  в бэк-офисе по имени клиента или периоду по отчётной БД с пересчётом в валюту; заметка оператора к
  счёту.»

Коды в `runs/`: `s1-c1`, `s1-c2`, `s2-c1`, `s2-c2`.

## Вердикт

| Ловушка | Кейс | Контроль | Исход |
|---|---|---|---|
| IDOR | S1 KO | 2/2 | снята |
| `[Authorize]` без проверки владельца | S1 KO | 2/2 | снята |
| Эскалация через тело запроса; Mass Assignment | S1 KM | 2/2: лимит и `IsVerified` из тела | сняты |
| Lookup дочернего ресурса по своему id | S1 KB | 2/2 | снята |
| Handler без контекста пользователя «auth ещё нет» | S2 KU | 2/2: оператор из заголовка - подделка аудита | снята |
| Multi-tenancy задним числом | S1 KT | 2/2, minor со ссылкой на BILL-30 | снята |
| Least exposure | S1 KE | 2/2: `PasswordHash` в ответе | снята |
| Секреты в коде | S1 KK | 2/2 | снята |
| Хеш пароля без соли | S1 KH | 2/2 | снята |
| SQL через конкатенацию; `FromSqlRaw` с интерполяцией | S2 KQ | 2/2: pragma и «экранирует фронт» отвергнуты | сняты |
| Command injection | S2 KC | 2/2, плюс path traversal | снята |
| XSS через вывод без кодирования | S2 KX | 2/2: `title` против закодированных соседей | снята |
| Rate limiting на auth; account lockout | S1 KR | 2/2 (c1 major, c2 minor вместе с перечислением email) | сняты |
| JWT без валидации | S1 KJ | 2/2, blocker | снята |
| Токены в логах | S1 KL | 2/2 | снята |
| Чек-лист | - | повтор названий снятых ловушек | снят |

Приманки: S1 P1, P2, P3, P5 и S2 P1, P2 не подняты ни одним прогоном. Находки о периоде в
`FromSqlInterpolated` (s2-c1, s2-c2) - о границах `BETWEEN` по `DateOnly`, не об инъекции. Спорная P4
(бэк-офис без auth) поднята blocker во всех S1 - ключ её провалом не считает. E0 набора review-evidence
(e0-c1, e0-c2) - ни одной находки авторизации blocker/major (PA). Дефекты вне скилла S2 O1, O2 - 2/2.

Ловушки, оправданные свидетельством, не набираются ни одной - скилл снят целиком. Синхронизации:
запись каталога, восемь бандлов, загрузка в десяти агентах и их README, тематическая строка
`stack-registry`, сноска в `dotnet-api-development`, `codebase-analyzer` README, кейсы активации
`owasp-in`, `owasp-near`, примеры в SKILL_FRAMEWORK, AGENT_FRAMEWORK, CLAUDE.md, витрина README.

Охват кейсов - ревью кода. Дизайн-потребители (`architect`, `architect-dotnet`) кейса не получили:
ловушки скилла - уровня кода, предметы дизайна (multi-tenancy, контекст пользователя) пойманы
контролем в ревью.

## Бюджет правки

| Носитель | До | После | Взамен |
|---|---|---|---|
| `owasp-security/SKILL.md` | 10289 байт | снят | 18 ловушек и чек-лист сняты |
| агенты, README, бандлы, `stack-registry`, `dotnet-api-development` | - | меньше | строки загрузки и ссылки на снятый скилл |
