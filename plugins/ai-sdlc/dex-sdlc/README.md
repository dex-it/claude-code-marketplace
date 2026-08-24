# dex-sdlc

Движок доведения цели до конца самостоятельно, когда спросить некого. Ведёт универсальный цикл,
стоп-линию, делегирование узлам-агентам по контракту `node-contract`, возобновление после компакта -
и диспетчит по трек-скиллу зоны, который называет вызывающий (команда или поручение). Порядка зоны
движок не знает: он живёт в своём `dex-skill-<зона>-track`.

**Агностично правило-тело, не плагин целиком.** Голое поручение («почини», «отревьюй») трека не
несёт - зону движок резолвит сам по `skills/engine/references/zone-registry.md`, а этот справочник
перечисляет зоны поимённо и растёт с каждой новой. Тело `SKILL.md` при заведении зоны не правится,
плагин ядра - правится (реестр, версия, README, команда зоны). Это цена резолва голого входа, не
дефект: без справочника его резолвить нечем.

## Три слоя

| Слой | Носитель | Несёт |
|---|---|---|
| Движок | этот плагин, `dex-sdlc:engine` | цикл, ledger, стоп-линия, возобновление, режимы, якоря `P-*`/`I-*` |
| Трек | `dex-skill-<зона>-track` | порядок зоны: фазы, гейты, состав узлов, DoD |
| Узел | субагент-специалист | одна работа: вход -> `status` |

Связку движок+трек держит вызывающий: команда вызывает `Skill` дважды (движок, затем трек) -
загрузки `skill -> skill` внутри тела нет, это прерогатива исполнителя (прецедент -
`dex-skill-artifact-review:artifact-review`).

## Команды

Команды-входы живут не в этом плагине, а в плагинах зон: роль ставит те зоны, которые ей нужны,
и не тащит остальные. Движок (`dex-sdlc:engine`) нужен каждой из них.

| Команда | Плагин | Трек |
|---|---|---|
| `/product` | `dex-sdlc-product` | `dex-skill-product-track:product-track` |
| `/feature` | `dex-sdlc-requirements` | `dex-skill-analytics-track:analytics-track` |
| `/feature-check` | `dex-sdlc-requirements` | без открытия цикла движка, см. Constraints команды |
| `/design` | `dex-sdlc-design` | `dex-skill-architecture-track:architecture-track` |
| `/discover` | `dex-sdlc-discover` | `dex-skill-discover-track:discover-track` |
| `/documentation` | `dex-sdlc-docs` | `dex-skill-documentation-track:documentation-track` |
| `/implement` | `dex-sdlc-delivery` | `dex-skill-development-track:development-track` |
| `/test` | `dex-sdlc-test` | `dex-skill-test-track:test-track` (под-вид `coverage`) |
| `/find-bugs` | `dex-sdlc-test` | `dex-skill-test-track:test-track` (под-вид `hunt`) |
| `/mr-review` | `dex-sdlc-review` | `dex-skill-mr-review-track:mr-review-track` |
| `/review-plan` | `dex-sdlc-review` | `dex-skill-followup-track:followup-track` |
| `/review-stand` | `dex-sdlc-acceptance` | `dex-skill-acceptance-track:acceptance-track` |
| `/root-cause` | `dex-sdlc-ops` | `dex-skill-diagnostics-track:diagnostics-track` |
| `/investigate` | `dex-sdlc-ops` | `dex-skill-diagnostics-track:diagnostics-track` |

Плагин зоны без своего трека команду не выполняет: замкнутость набора проверяет
`npm run validate:bundles` (правило `bundle-command-not-closed`).

## Треки каталога

| Трек | Плагин | Особенность |
|---|---|---|
| Продукт (зона продукта) | `dex-skill-product-track` | - |
| Требования (зона требований) | `dex-skill-analytics-track` | - |
| Разработка | `dex-skill-development-track` | - |
| Архитектура/дизайн | `dex-skill-architecture-track` | - |
| Баг-фикс | `dex-skill-bugfix-track` | под-вид Разработки: своей команды нет, вход и выход - через `development-track` |
| Обработка ревью своего MR | `dex-skill-followup-track` | - |
| Приёмка на стенде | `dex-skill-acceptance-track` | - |
| Обзорное ревью кода | `dex-skill-discover-track` | трек-делегат: конвейер обзора ведёт `dex-code-discovery:discover-orchestrator` |
| Тест-инжиниринг | `dex-skill-test-track` | два под-вида: `coverage` (`/test`) и `hunt` (`/find-bugs`) |
| Ревью входящего MR | `dex-skill-mr-review-track` | - |
| Документирование | `dex-skill-documentation-track` | - |
| Диагностика/инцидент | `dex-skill-diagnostics-track` | - |

**Критерий полноты трека** - все четыре пункта, проверяет ревью трека:

1. порядок выражен фазами-контрактами: у каждой Goal / Output / Exit criteria / Mandatory с обоснованием;
2. вход зоны принимается по `node-contract` (входная приёмка по метке `quality-checks`, названная
   реакция на нехватку), выход отдан явным handoff следующему треку;
3. гейты и режимы названы: что блокирует, что фиксирует и пропускает, чем `autonomous` отличается
   от `interactive` в каждом гейте;
4. состав узлов назван поимённо - что трек делает сам, что делегирует.

Хоть один пункт не выполнен - трек не готов к включению в таблицу, сколько бы текста в нём ни было:
критерий проверяется по тексту трека, а не по объёму.

## Возобновление после компакта

Три действия, все явные вызовы `Skill` - бюджет реаттача (5000 токенов последнего вызова на
скилл, потолок 25000 разом) ни один не тратит, каждый грузит тело целиком из живого окна:
`Skill` -> `dex-sdlc:engine` -> `Read` авто-леджера (файл, в бюджет реаттача не входит вовсе) ->
`Skill` на трек из шапки цели (безусловно) + `Skill` на процессные нормы раздела
`## Действующие нормы`, не помеченные отработанными. Профильные скиллы под кусок работы по записи
трейла не поднимаются - переотбираются по предмету незакрытого пункта. Подробности - раздел
«Возобновление» в `SKILL.md`.
