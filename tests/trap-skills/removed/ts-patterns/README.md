# [снят] ts-patterns: сжатие по свидетельству, группа 2.3

Скилл `dex-skill-ts-patterns` 2.0.1 ([`inputs/SKILL-2.0.1.md`](inputs/SKILL-2.0.1.md)), эпик #291, группа 2.3
(#298). Итог - скилл снят целиком; единица «внешние данные без проверки» закрыта существующей строкой Boundaries
агента-потребителя `ts-fullstack-assistant`. Строка в реестре [`tests/README.md`](../../../README.md).

Вход, исполнитель (`claude-sonnet-5-5`, effort medium, `claude -p` 2.1.291, MCP нет), среда, промпты, правило
засчитывания, шаг 0 и расход - общие для группы, в протоколе
[ts-nodejs-api](../../ts-nodejs-api/README.md#заход-группы-23-2026-10-06). В контроле скиллов нет, в `n1` и `f` снятый
скилл не подавался: снятие по контролю. Здесь - выходы K0
(«ничего не менять», общий для группы) и прогоны носителя (`d`, `n` на K1, `n` на K0 и K2): `runs/`. Прогоны
K1 и R1 - в [ts-nodejs-api](../../ts-nodejs-api/README.md), K2 и R2 - в [react](../../react/README.md), K3 - в
[ts-vitest-jest](../../ts-vitest-jest/README.md).

## Потребители

До снятия: `ts-fullstack-assistant` (Phase 0 - дом `strict: true`; Phase 3 - type guards, strict mode,
discriminated unions), `ts-test-writer` (типизация и async-ловушки тестируемого кода), `debugger` (by-stack,
пример TypeScript/JS), `project-baseline` (пример стекового скилла), узлы `dex-auto` reviewer и debugger -
по суждению (журнал `plugins/auto/docs/notes/probes.md`, P94, P98), ось стека `discover-reviewer` и
`mr-reviewer` по префиксу `dex-skill-ts-*` (`stack-registry`). Бандл `ts-fullstack`. Кейс активации
`ts-patterns-in`. Сторона пишущего - K0-K3, ревью - R1, R2.

## Вердикт

| Ловушка 2.0.1 | Кейс | Контроль | Исход |
|---|---|---|---|
| P1 any вместо unknown; P2 Type assertion вместо narrowing; P10 `typeof null === 'object'` | K1-P1 (шлюз оплаты), R1 K-N7 (`as CreateRefund`) | K1 0/2; R1 4/4 | закрыта строкой Boundaries `ts-fullstack-assistant`, ниже |
| P3 Enum вместо union type | приманка B1 | - | снята без прогона: конвенция команды - свод правил проекта; B1 не поднята ни разу |
| P4 Забытый return type на public API | - | - | снята без прогона: конвенция - свод правил проекта |
| P5 Non-null assertion в production | R1 K-P5 | 2/2 | снята |
| P6 Последовательные await вместо параллельных | приманка B3 | - | снята как дубль: `performance-review` «Независимые await последовательно», снят там контролем 2/2; B3 не поднята |
| P7 Promise.all без error handling | K1 M4 | 2/2 | снята |
| P8 Забытый await | K1 M4, R1 K-P8 | 2/2, 2/2 | снята |
| P9 .then/.catch смешивание с async/await | - | - | снята без прогона: стиль; безмолвный fallback - `no-loose-ends`, снят в группе 1.1 |
| P11 Сравнение объектов через === | R1 K-P11 | 2/2 | снята |
| P12 Мутация аргументов | R2 K-P12 | 2/2 | снята |
| P13 strict: false | R2 K-P13 | 2/2 | снята; `strict: true` в baseline - норма каталога в `ts-fullstack-assistant` Phase 0 |
| P14 skipLibCheck: true скрывает ошибки зависимостей | - | - | снята без прогона: документация TypeScript (`skipLibCheck`) описывает флаг нейтрально - «Skip type checking of declaration files», без запрета |
| Чек-лист | - | повтор названий | снят |

K0 («ничего не менять»): дифф только по задаче - `product.ts`, seed, тест, `ProductsPage`, `money.ts`,
`types.ts`; предмет ловушек не тронут, typecheck и test зелёные - контроль 2/2, `n1` 2/2, `f` 2/2, `n` 2/2.

## K1-P1: чтение ключа

Ключ K1-P1 (коммит `caccb0c1`, до прогонов) противоречив: «Провал» называет `as`, «Допустимо» - type guard с
проверкой `status`, нужного поля и `null`. Оркестратор (06.10.2026, коммит `35c47a56`) выбрал буквальное чтение:
любое `as` - провал. Ревью #318 его сняло: по нему провалом засчитан разбор из колонки «Допустимо» (`k1-da`,
`k1-db`), и норма судилась строже собственного текста. K1-P1 судится по существу: тело ответа шлюза проверено
при исполнении до использования; `as` внутри проверенной ветки - допустимо. Ключ не правился.

| Прогон | Разбор тела ответа шлюза | Исход |
|---|---|---|
| `k1-c1` | `(await res.json().catch(() => null)) as {...} \| null`, далее `body?.status`, `transaction_id` по истинности | провал: тип поля не проверен |
| `k1-c2` | `as typeof body`, проверка `status` и `transaction_id` без проверки `null`: тело `null` - TypeError, ответ 5xx | провал |
| `k1-n1a`, `k1-n1b`, `k1-fa`, `k1-fb`, `k1-f2a`, `k1-f2b` | `as typeof body` / `as ChargeResponse` (`ts-patterns` не подан) | провал 0/6 |
| `k1-da`, `k1-db` | `body: unknown`, guard `typeof body === 'object' && body !== null`, затем `as Record<string, unknown>` и `typeof` каждого поля | 2/2 |
| `k1-na`, `k1-nb` | zod `safeParse` тела ответа | 2/2 |

Контроль 0/2 - единица не снимается. Сторона ревью (R1 K-N7) нашла `parse(...) as CreateRefund` при опциональной
сумме 4/4, но у пишущего здесь свой прямой провал, он перевешивает (как N12 в ts-nodejs-api).

## Носитель: строки агента

Скилл ради одной единицы не восстанавливается: по решению владельца эпика (группа 1, тред #314) дом одной-двух
вернувшихся единиц снятого скилла - ось агента-потребителя. Выбран `ts-fullstack-assistant`: K1 - его поручение
(HTTP-клиент внешнего сервиса в Node API), до снятия он грузил `ts-patterns` в Phase 3, и в его Boundaries уже
стоит строка «`any` без явного обоснования не используется; нужен escape hatch -- `unknown` + type guard».

Носитель: раннер не исполняет агента целиком (фазы агента требуют `Skill` tool и pre-load `node-contract`,
которых у исполнителя прогона нет), поэтому строки агента поданы файлом, как оси ревьюеров в группе 1.1
(прецедент [owasp-security](../owasp-security/README.md#возврат-названием)): Generate (цель и выход), Validate
(чек-лист, в нём «Нет `any` / `as` без обоснования») и Boundaries. `d` - строки без названия
([`inputs/AXES-d.md`](inputs/AXES-d.md)), `n` - с названием «Сюда же ответ внешнего сервиса, приведённый `as` к
типу без проверки при исполнении» ([`inputs/AXES-n.md`](inputs/AXES-n.md)); скиллы - итоговые `ts-nodejs-api`,
`react` (с `PAYMENT_URL` в `description`, см. ts-nodejs-api; на P1 не влияет).

| Кейс | `d` | `n` | Остальное |
|---|---|---|---|
| K1 | P1 2/2 | P1 2/2 | мины M1-M6 PASS 4/4, статус ответа шлюза проверен 4/4, env при старте 4/4 |
| K0 | - | дифф только по задаче 2/2 | typecheck, test зелёные |
| K2 | - | - | мины M1-M4 PASS 2/2 |

Строки агента без названия единицу держат: `d` разбирает тело через `unknown` и guard с проверкой каждого поля.
Название сверх строки «`unknown` + type guard» исхода не меняет - в агент не дописано, единица закрыта
существующей строкой Boundaries.

## Синхронизации

Набор - здесь. Запись каталога снята, каталог 6.11.0; бандл `ts-fullstack` (bundle.json, README) 1.35.0.
Агенты: `ts-fullstack-assistant` (Phase 0 - ссылка на дом `strict: true`, Phase 3 - строка загрузки), `ts-test-writer` (строка загрузки), `debugger` (by-stack пример). `project-baseline` - пример стекового
скилла. Корневой README (витрина «Frontend и TypeScript»), `docs/SKILL_FRAMEWORK.md` и `CLAUDE.md` (пример
стекового префикса -> `ts-nodejs-api`; правка `CLAUDE.md` - решение оркестратора), `mr-reviewer` README.
Кейс активации `ts-patterns-in` снят. Журнал `plugins/auto/docs/notes/probes.md` (P94, P98) - история прогонов,
не правился. `stack-registry` перечисляет префикс `dex-skill-ts-*`, не имена - без правки.

## Открыто

- Ключ `shopdesk` K1-P1 противоречив и не правился: чтение по существу записано выше (ревью #318).
- `ts-test-writer`, `debugger`, узлы `dex-auto` и ось стека ревьюеров по снятому скиллу кейса не получили:
  их предмет из `ts-patterns` (P5, P7, P8, P11-P13) снят контролем пишущего и ревью.
- Пересечение по предмету с `dotnet-async-patterns` (#296): фоновый промис без обработки отказа (P7, P8) - здесь
  снят контролем.

## Бюджет правки

| Носитель | До | После | Взамен |
|---|---|---|---|
| `ts-patterns/SKILL.md` | 5102 символа, 94 строки | снят | 14 ловушек и чек-лист сняты, P1/P2/P10 - строкой агента |
| `ts-fullstack-assistant.md` | 12038, 150 | 11943, 149 | строка загрузки и сноска на дом `strict` сняты, строки React и Node переписаны под оставшиеся пункты |
| `ts-test-writer.md` | 12186, 130 | 12142, 129 | строка загрузки снята, строка `ts-vitest-jest` - под оставшиеся ловушки |
| `debugger.md` | 17447, 178 | 17433, 178 | by-stack пример TypeScript/JS |
| `project-baseline/SKILL.md` | 7698, 134 | 7673, 134 | пример стекового скилла |
| `bundles/dex-bundle-ts-fullstack/README.md` | 2101, 60 | 2055, 59 | строка скилла |
| `README.md` | 28491, 479 | 28476, 479 | витрина |
| `docs/SKILL_FRAMEWORK.md` | 40603, 384 | 40605, 384 | пример префикса |
| `CLAUDE.md` | 29437, 147 | 29439, 147 | пример префикса |

Рез через
`dex-skill-optimize-for-llm` не вызывался (`Skill` в сессии исполнителя группы нет) - `unverifiable`.
