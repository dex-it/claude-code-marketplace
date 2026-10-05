# [снят] owasp-security: сжатие по свидетельству, группа 1.1

Скилл `dex-skill-owasp-security` 1.3.2 ([`inputs/SKILL-1.3.2.md`](inputs/SKILL-1.3.2.md)), эпик
#291, группа 1.1 (#293). Итог - скилл снят, 17 ловушек и чек-лист - по контролю; multi-tenancy задним
числом контролем не набрана и возвращена названием в ось Security трёх агентов ревью. Строка в
реестре [`tests/README.md`](../../../README.md).

Вход - общий мини-проект [`_projects/billing`](../../_projects/billing/README.md), кейсы S1, S2,
ключ там же; дополнительно E0 набора [review-evidence](../../review-evidence/README.md) - кейс без
owasp-дефектов. Вердикт - по перепрогону на `claude-sonnet-5-5`, effort medium (раздел
[«Перепрогон по ревью PR #314»](#перепрогон-по-ревью-pr-314-2026-10-05)); первый заход (алиас
`sonnet`, effort не задан - наследовался от сессии оператора, субагент `general-purpose`, MCP сессии
доступны) - справочно. Прогоны `c` - контроль без скилла; со скиллом прогонов нет: снятие по контролю.

S1 и S2 - общий контроль группы 1.1: те же прогоны засчитываются `performance-review`, `testability`,
`no-loose-ends`; вердикты по ним - в их протоколах.

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

Коды в `runs/`: `m-S1-c1`..`m-S1-c4`, `m-S2-c1`..`m-S2-c4` - контроль без скилла (вердикт);
`m-S1-n1`..`m-S1-n4`, `m-S2-n1`, `m-S2-n2`, `m-E0-n1` - контроль с названиями ситуаций в осях агента
([`inputs/AXES-named.md`](inputs/AXES-named.md), раздел «Возврат названиями»); `s1-c*`, `s2-c*` - первый
заход, справочно.

## Перепрогон по ревью PR #314 (2026-10-05)

`claude -p` 2.1.287, `--model claude-sonnet-5-5 --effort medium`, `--restricted --strict-mcp-config
--disable-slash-commands` (MCP нет, файлы настроек пользователя и проекта не читаются), инструменты
Bash, Read, Write, Edit, Grep, Glob. Каталог прогона - копия мини-проекта вне репозитория, `CLAUDE.md`
на пути нет ни пользовательского, ни проектного. Промпт - прежний. Среда: .NET SDK 10.0.203, рантайм
только 10.0.7 - сборка проходит, `dotnet test` (net8.0) не запускается. Ключ S1, S2, E0 записан
коммитом `05fc7815` (2026-10-04) и после него не менялся; прогоны - 2026-10-05, после ключа. Контроль -
по 4 прогона на S1 и S2.

## Вердикт

| Ловушка | Кейс | Контроль medium | Исход |
|---|---|---|---|
| IDOR | S1 KO | 4/4 | снята |
| `[Authorize]` без проверки владельца | S1 KO | 4/4 | снята |
| Эскалация через тело запроса; Mass Assignment | S1 KM | 4/4: лимит и `IsVerified` из тела | сняты |
| Lookup дочернего ресурса по своему id | S1 KB | 4/4 | снята |
| Handler без контекста пользователя «auth ещё нет» | S2 KU | 4/4: оператор из заголовка - подделка аудита | снята |
| Multi-tenancy задним числом | S1 KT | **2/4**: c4 - «Customer/Invoice без идентификатора компании», c1 - поиск по email без компании при BILL-30; c2, c3 - нет | возвращена названием, см. ниже |
| Least exposure | S1 KE | 4/4: `PasswordHash` в ответе | снята |
| Секреты в коде | S1 KK | 4/4 | снята |
| Хеш пароля без соли | S1 KH | 4/4 | снята |
| SQL через конкатенацию; `FromSqlRaw` с интерполяцией | S2 KQ | 4/4 | сняты |
| Command injection | S2 KC | 4/4, плюс path traversal | снята |
| XSS через вывод без кодирования | S2 KX | 4/4: `title` против закодированных соседей | снята |
| Rate limiting на auth; account lockout | S1 KR | 4/4 | сняты |
| JWT без валидации | S1 KJ | 4/4 | снята |
| Токены в логах | S1 KL | 4/4 | снята |
| Чек-лист | - | повтор названий | снят |

Приманки S1 P1-P3, P5 и S2 P1, P2 не подняты ни одним прогоном. Спорная P4 (бэк-офис без auth) -
ключ провалом не считает. Дефекты вне скилла S2 O1, O2 - 4/4. Первый заход давал KT 2/2 (minor со
ссылкой на BILL-30) - на паре решения 1 эпика он не повторился.

Охват кейсов - ревью кода. Дизайн-потребители (`architect`, `architect-dotnet`) кейса не получили:
ловушки скилла - уровня кода; изоляция арендатора в их фазах названа своей строкой, у
`security-reviewer` multi-tenant грузит `dex-skill-nfr` («Multi-tenant без tenant_id в schema»).

## Возврат названием

Скилл ради одной ловушки не восстанавливается: дом - ось Security агентов, которые ревьюят код дельты
и раньше грузили скилл по этой оси, - `mr-reviewer`, `self-reviewer`, `mr-check-reviewer`. Форма -
шаг 1 «Формы пункта»: название ситуации «мультиарендность задним числом» в строке оси, без решения.
Восстановление скилла из одного названия стоило бы записи каталога, плагина, строк загрузки в тех же
агентах и бандлов.

Проверка - тот же промпт, строки осей `mr-reviewer` с возвращёнными названиями поданы файлом
дисциплины ([`inputs/AXES-named.md`](inputs/AXES-named.md)), там же названия недоделок
[no-loose-ends](../no-loose-ends/README.md#возврат-названиями):

| Кейс | Прогоны | KT | Остальное |
|---|---|---|---|
| S1 | n1-n4 | 4/4 по признаку контроля; строго («нет измерения компании») 3/4 - n1 вывел BILL-30 через глобальную уникальность email | все K S1, приманки чисты |
| S2 | n1, n2 | - | все K S2, O1, O2 |
| E0 | n1 | - | 3 minor, PA - minor (не blocker), ложных blocker/major нет |

Название поднимает KT с 2/4 до 4/4 (строго - с 1/4 до 3/4). Выбор дома - вопрос автору в треде PR
#314: агенты либо восстановленный скилл из названий.

## Бюджет правки

Символы и строки носителя, `origin/develop` -> ветка.

| Носитель | До | После | Взамен |
|---|---|---|---|
| `owasp-security/SKILL.md` | 7344 симв., 122 строки | снят | 17 ловушек и чек-лист сняты, KT - названием в агентах |
| `mr-reviewer.md` | 25160, 252 | 24427, 248 | строка загрузки снята; в Security +32 символа названия |
| `self-reviewer.md` | 16462, 151 | 15952, 147 | то же, +32 |
| `mr-check-reviewer.md` | 18254, 177 | 17803, 173 | то же, +54 |
| `security-reviewer.md` | 10418, 134 | 10311, 133 | строка «Всегда - owasp-security» |
| прочие агенты, README, бандлы, `stack-registry`, `dotnet-api-development` | - | меньше | строки загрузки и ссылки на снятый скилл, числа - в таблице ниже |

Синхронизации: запись каталога, восемь бандлов, загрузка в десяти агентах и их README, тематическая
строка `stack-registry`, сноска в `dotnet-api-development`, `codebase-analyzer` README, кейсы
активации `owasp-in`, `owasp-near`, примеры в SKILL_FRAMEWORK, AGENT_FRAMEWORK, CLAUDE.md, витрина
README.

## Бюджет синхронизаций группы 1.1

Все тронутые группой носители, кроме самих шести скиллов (их строки - в протоколах): символы и
строки, `origin/develop` -> ветка. Рост - только у `completeness-mapping` (+8: ссылка на снятый
`no-loose-ends` заменена исходом «дома нет, проверяй сам», остальная разница файла - замена длинного
тире на ASCII без изменения длины). Строки осей агентов ревью возвращены к тексту develop, кроме
Security, Performance и строки загрузки `regressions` (их предмет мерили S1, S2, A-D); названия,
возвращённые по провалам контроля, - внутри этих чисел.

| Носитель | До | После |
|---|---|---|
| `CLAUDE.md` | 29520, 147 | 29437, 147 |
| `docs/AGENT_FRAMEWORK.md` | 79242, 1017 | 79239, 1017 |
| `docs/SKILL_FRAMEWORK.md` | 40645, 384 | 40612, 384 |
| `docs/migration/claude5-context-inventory.md` | 7221, 74 | 7203, 74 |
| `docs/pipelines/analytics/ARCHITECTURE.md` | 9635, 159 | 9617, 159 |
| `plugins/bundles/dex-bundle-architect/README.md` | 2416, 64 | 2362, 63 |
| `plugins/bundles/dex-bundle-bug-lifecycle/README.md` | 1743, 34 | 1688, 34 |
| `plugins/bundles/dex-bundle-code-review/README.md` | 4453, 70 | 4244, 67 |
| `plugins/bundles/dex-bundle-product-manager/README.md` | 3423, 76 | 3367, 75 |
| `plugins/skills/dex-skill-completeness-mapping/skills/completeness-mapping/SKILL.md` | 8709, 115 | 8717, 115 |
| `plugins/skills/dex-skill-dotnet-api-development/skills/dotnet-api-development/SKILL.md` | 8969, 124 | 8937, 124 |
| `plugins/skills/dex-skill-karpathy-guidelines/skills/karpathy-guidelines/SKILL.md` | 5020, 78 | 4862, 76 |
| `plugins/skills/dex-skill-node-contract/skills/node-contract/references/finding-return.md` | 1550, 23 | 1530, 23 |
| `plugins/skills/dex-skill-optimize-for-llm/skills/optimize-for-llm/SKILL.md` | 26302, 129 | 26256, 129 |
| `plugins/skills/dex-skill-post-merge-remediation/skills/post-merge-remediation/SKILL.md` | 3344, 44 | 3283, 44 |
| `plugins/skills/dex-skill-stack-registry/skills/stack-registry/SKILL.md` | 5809, 89 | 5717, 88 |
| `plugins/skills/dex-skill-stand-verification/skills/stand-verification/SKILL.md` | 5889, 71 | 5621, 71 |
| `plugins/specialists/architecture/dex-architect-dotnet/README.md` | 4254, 66 | 4181, 65 |
| `plugins/specialists/architecture/dex-architect-dotnet/agents/architect-dotnet.md` | 18191, 280 | 17968, 278 |
| `plugins/specialists/architecture/dex-architect/README.md` | 3898, 62 | 3774, 61 |
| `plugins/specialists/architecture/dex-architect/agents/architect.md` | 17818, 216 | 17582, 214 |
| `plugins/specialists/architecture/dex-code-discovery/README.md` | 4618, 57 | 4590, 57 |
| `plugins/specialists/architecture/dex-code-discovery/agents/discover-reviewer.md` | 10831, 130 | 10788, 130 |
| `plugins/specialists/architecture/dex-design-reviewer/README.md` | 3346, 42 | 3318, 42 |
| `plugins/specialists/architecture/dex-design-reviewer/agents/design-reviewer.md` | 25328, 210 | 25259, 208 |
| `plugins/specialists/delivery/dex-bug-fixer/agents/bug-fixer.md` | 14857, 139 | 14791, 137 |
| `plugins/specialists/delivery/dex-debugger/agents/debugger.md` | 17489, 178 | 17447, 178 |
| `plugins/specialists/delivery/dex-incident-investigator/README.md` | 1677, 32 | 1648, 32 |
| `plugins/specialists/delivery/dex-incident-investigator/agents/incident-investigator.md` | 16233, 167 | 16078, 165 |
| `plugins/specialists/delivery/dex-review-planner/README.md` | 1734, 23 | 1722, 23 |
| `plugins/specialists/delivery/dex-review-planner/agents/review-planner.md` | 11956, 126 | 11912, 126 |
| `plugins/specialists/delivery/dex-security-reviewer/agents/security-reviewer.md` | 10418, 134 | 10311, 133 |
| `plugins/specialists/qa/dex-bug-finder/README.md` | 1487, 33 | 1459, 33 |
| `plugins/specialists/qa/dex-bug-finder/agents/bug-finder.md` | 8365, 113 | 8281, 113 |
| `plugins/specialists/review/dex-mr-check-reviewer/README.md` | 1479, 22 | 1451, 22 |
| `plugins/specialists/review/dex-mr-check-reviewer/agents/mr-check-reviewer.md` | 18254, 177 | 17803, 173 |
| `plugins/specialists/review/dex-mr-reviewer/README.md` | 2376, 27 | 2229, 27 |
| `plugins/specialists/review/dex-mr-reviewer/agents/mr-reviewer.md` | 25160, 252 | 24427, 248 |
| `plugins/specialists/review/dex-requirements-reviewer/README.md` | 2758, 32 | 2719, 32 |
| `plugins/specialists/review/dex-requirements-reviewer/agents/requirements-reviewer.md` | 24214, 225 | 24151, 223 |
| `plugins/specialists/review/dex-self-reviewer/README.md` | 2108, 24 | 1962, 24 |
| `plugins/specialists/review/dex-self-reviewer/agents/self-reviewer.md` | 16462, 151 | 15952, 147 |
| `plugins/specialists/review/dex-stand-reviewer/README.md` | 1980, 32 | 1896, 32 |
| `plugins/specialists/review/dex-stand-reviewer/agents/stand-reviewer.md` | 18806, 161 | 18586, 161 |
| `plugins/utilities/dex-codebase-analyzer/README.md` | 4554, 81 | 4533, 81 |
