# Источники: форма пункта trap-skill - вектор или решение

Фаза 1 исследования. Здесь собрано то, на что опирается предрегистрация
([PREREG.md](PREREG.md)): как развивалась идея, что говорят первоисточники Anthropic, какие кейсы
уже есть и чему в прошлых прогонах нельзя доверять без оговорки.

## 1. Линия идеи

### Слова Макса

Чат, 26.09.2026: «мысль в том что бы формулировать вектор а не решение, удочку - не рыбу; модель уже
очень умна и наши решения могут ее ограничить»; «гонял много тестов, но уверенности нет на 100, это
сонет5, не опус даже; небольшими но ёмкими словами сдвинуть вектор».

### Как менялась форма пункта

| Шаг | Где | Форма пункта | Свидетельство |
| --- | --- | --- | --- |
| 1 | PR #263 (25.09), `norm-writing` 1.1.0 | Норма сжата 8099 -> 3457 символов: снято всё без свидетельства ошибки, возвращено по фразе на каждый провал | Живые прогоны N-01..N-08, субагент, `Skill` запрещён |
| 2 | Эпик #264, коммит 909011ba (26.09) | Ловушка-подсказка: «Плохо» - ситуация, «Правильно» - что сверить по документации версии, «Почему» - исход; готовый ответ снят; факт библиотеки - только в «Почему», если поиск его не находит | ef-core 2.8.0: 28 ловушек -> 5; `timestamptz` оставлен, «поиск без context7 его не находит» |
| 3 | Коммит a5cfaebf | Мера skill - «применит ли модель сама», а не «знает ли»; база дважды, снятие только при двух верных прогонах | Метод, шаг 2 |
| 4 | Коммит f7c4b8f8, PR #280 | «Форма пункта»: название ситуации по умолчанию, шаги 2-4 (факт версии, что сверить / обязательный исход, триада) - только провалом шага ниже | ef-core 3.0.0: названия 8/8 и 10/10 (заход 3, с предписанием поиска); performance-review 1.1.0 на opus 2/2 |
| 5 | Коммит a2230e26 | fact-verification 2.0.0: 7 триад -> вводная и 5 пунктов | 32 прогона sonnet: контроль 10/16, триады 11/16, чек-лист 14/16 |
| 6 | Коммиты c2fbeef0, f3dbae24 (ревью PR #280) | Шаг 3 поставлен для двух пунктов ef-core; форма мерится заданием без предписания поиска | Заход 4: названия E4 0/4, обязательный исход 2/2 |

Идея шла от сжатия норм (#263) к trap-skill (#264, #280). В эпике готовый ответ ещё заменялся
подсказкой «что сверить по документации», в PR #280 - уже названием ситуации. Свидетельства Макса -
заходы 1-3 набора ef-core, performance-review, fact-verification и снятие трёх скиллов. Во всех
заходах ef-core, кроме четвёртого, в задании было предписание искать документацию.

### Что уже измерено в репозитории

Протоколы: [`tests/trap-skills/`](../../../tests/trap-skills/README.md), реестр -
[`tests/README.md`](../../../tests/README.md#реестр-прогонов).

За «вектор» (готовое решение не нужно или вредит):

- config-hygiene (sonnet, ревью): прибавка скилла - два minor-дефекта. Вред: ловушка «non-nullable
  без `required`» неверна; оба прогона со скиллом её повторили. Подстановку `${VAR}` в Staging контроль
  нашёл 2/2, прогоны со скиллом 0/2 и назвали её правильным паттерном.
- linq (sonnet): L5 со скиллом режет запрос `Chunk(500)` по неверной ловушке «`Contains` с огромным
  списком». Дефекты MR-A вне скилла: без скилла 2/2, со скиллом 0/2.
- ef-core, заход 4: 2.6.2 (триады) проваливает E2 0/2 при базе 2/2; ложная находка на приманке
  `AsSplitQuery` 2/2; `Restrict` из готового «Правильно» дал регрессию.
- performance-review (opus): контроль без скилла ловит все засеянные дефекты, кроме двух.
- fact-verification (sonnet): триады 11/16 против чек-листа 14/16; прибавку триада дала на одной
  единице («разрешение нормы без условия», 0/2 -> 2/2).

Против «вектора» (названия не хватает):

- ef-core, заход 4, E4 (soft-delete + required FK + `timestamp`): названия 0/4, «что сверить» 0/2,
  обязательный исход 2/2, триады 2.6.2 2/2.
- K1, keyed-сервисы: база 1/2, название 1/2, обязательный исход 2/2.
- MR-A: чек-лист ef-core сужает ревью - дефекты вне скилла: база 4/4, со скиллом 2/4. Сужает и
  короткая форма, не только триада.
- fact-verification: «отрицательный факт над сломанным обходом» - ни одна форма не выше контроля 1/2.

Название работает там, где исполнитель не замечает ситуацию: L5, дедуп входа - 0/2 -> 2/2.

Поиск: в 30 прогонах захода 4 со скиллом ноль вызовов WebSearch/WebFetch. Вводная «решение - по
документации версии» поиск не вызывает. С предписанием поиска база даёт 9/10.

Доставка: активация `norm-writing` через `claude -p --plugin-dir` - 0/2. Скилл виден в сессии, но
не вызван ни разу (реестр, 25.09.2026). Все прогоны форм шли с подачей скилла путём к файлу.

## 2. Первоисточники Anthropic

Сверено WebFetch 28.09.2026. Копия страницы о промптинге - в `~/.cache/research/sources/`, вне
репозитория.

### Skill authoring best practices

<https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices>

- «**Default assumption:** Claude is already very smart. Only add context Claude doesn't already
  have.» Проверочные вопросы: «Does Claude really need this explanation?», «Does this paragraph
  justify its token cost?»
- «Set appropriate degrees of freedom. Match the level of specificity to the task's fragility and
  variability.»
  - High freedom - «Multiple approaches are valid; Decisions depend on context; Heuristics guide the
    approach».
  - Medium - «A preferred pattern exists; Some variation is acceptable».
  - Low - «Operations are fragile and error-prone; Consistency is critical; A specific sequence must
    be followed».
  - Аналогия: «Narrow bridge with cliffs on both sides: ... Provide specific guardrails and exact
    instructions (low freedom)»; «Open field with no hazards: ... Give general direction and trust
    Claude to find the best route (high freedom). Example: code reviews where context determines the
    best approach.»
- «Test with all models you plan to use. ... What works perfectly for Opus might need more detail for
  Haiku.» Вопросы по тирам: Haiku - «Does the Skill provide enough guidance?», Opus - «Does the Skill
  avoid over-explaining?»
- «Build evaluations first. Create evaluations BEFORE writing extensive documentation.» Порядок: «Run
  Claude on representative tasks without a Skill. Document specific failures», «Establish baseline»,
  «Write minimal instructions: Create just enough content to address the gaps and pass evaluations».
- «Avoid offering too many options ... Provide a default (with escape hatch)».
- Examples pattern: «Examples convey the desired style and level of detail to Claude more clearly than
  descriptions alone.»
- Чек-лист тестирования: «At least three evaluations created», «Tested with Haiku, Sonnet, and Opus».

### Prompting best practices

<https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices>
(охватывает Opus 5.5, Sonnet 5, Haiku 4.5 и другие).

- «Where a technique names a specific model, treat it as measured on that model and re-check it
  against your own evals before applying it to another.»
- «Providing context or motivation behind your instructions, such as explaining to Claude why such
  behavior is important, can help Claude better understand your goals ... Claude is smart enough to
  generalize from the explanation.»
- «Think of Claude as a brilliant but new employee who lacks context on your norms and workflows.»
- Примеры: «Relevant ... Diverse: Cover edge cases and vary enough that Claude doesn't pick up
  unintended patterns.»

### Prompting Claude Sonnet 5

<https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5>

- «Claude Sonnet 5 interprets prompts literally and explicitly, particularly at lower effort levels.
  It does not silently generalize an instruction from one item to another, and it does not infer
  requests you didn't make.»
- Tool use: «Claude Sonnet 5 is more agentic than Claude Sonnet 4.6 by default ... if you find the
  model is not using your web search tools, clearly describe why and how it should.» «`high` or
  `xhigh` effort settings show substantially more tool usage.»
- Effort: «On Claude Sonnet 5, effort defaults to `high`».
- Code review harnesses: «When a review prompt says things like "only report high-severity issues,"
  ... Claude Sonnet 5 may follow that instruction more faithfully than earlier models did ...
  measured recall can fall».

### Prompting Claude Opus 5.5

<https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5>

- «Start at `medium`, the default on Claude Opus 5.5».
- «Early testers also reported stronger code review, with more bugs caught than on Claude Opus 5 and
  fewer false alarms».

### Claude Code: Skills

<https://code.claude.com/docs/en/skills>

- «When you or Claude invoke a skill, the rendered `SKILL.md` content enters the conversation as a
  single message and stays there across later turns.»
- «Claude Code re-attaches the most recent invocation of each skill after the summary, keeping the
  first 5,000 tokens of each. Re-attached skills share a combined budget of 25,000 tokens.»
- «Reference content adds knowledge Claude applies to your current work. Conventions, patterns, style
  guides, domain knowledge.»
- «Keep the body itself concise. ... State what to do rather than narrating how or why».
- `description`: «Claude uses this to decide when to apply the skill.»

### Что за идею Макса и что против

За:

- «Claude is already very smart» и «Only add context Claude doesn't already have» - прямо идея Макса.
  «Build evaluations first» и базовый прогон без скилла - это метод «Сжатие по свидетельству».
- High freedom рекомендован для ревью кода.
- «Code review harnesses» на Sonnet 5: ограничивающая формулировка снижает recall. Это механизм
  сужения ревью, которое прогоны показали на linq и MR-A.
- Opus 5.5 ловит больше дефектов с меньшим числом ложных находок. Готовые ответы нужны ему меньше.

Против или с оговорками:

- Low freedom нужен там, где «operations are fragile» и «consistency is critical». Необратимая
  операция над данными (каскад при soft-delete) и конвенция команды (keyed-ключи) - такие места.
- «Test with all models»: Haiku нужно больше деталей. Вывод на sonnet не переносится на haiku.
- Sonnet 5 «does not silently generalize an instruction from one item to another» и «does not infer
  requests you didn't make». Название ситуации без исхода - как раз инструкция, которую надо вывести.
  Для sonnet это аргумент против формы F1 там, где исход не очевиден.
- Поиск вызывается описанием «why and how». Строка «решение - по документации» поиск не вызвала
  (заход 4). Это согласуется с документацией: удочка без явного «когда и зачем ловить» не работает.
- «Brilliant but new employee who lacks context on your norms» - конвенции команды модель не выведет.

### Лестница «Формы пункта» против degrees of freedom

| Форма пункта | Свобода по Anthropic | Совпадение |
| --- | --- | --- |
| 1 - название | high: «general direction» | да |
| 2 - + факт версии | high + контекст («only add context Claude doesn't already have») | да: факт - то, чего модель не знает |
| 3 - + что сверить / обязательный исход | medium: «a preferred pattern exists» | «что сверить» - high, «обязательный исход» - medium/low |
| 4 - триада с «Правильно» | low: «specific guardrails and exact instructions» | да, но у Anthropic low - для хрупких операций, а не формат по умолчанию |

Расхождение одно. Anthropic выбирает степень свободы по свойству задачи: хрупкость, вариативность,
цена ошибки. «Форма пункта» ставит шаг выше только по провалу прогона. Признак «хрупкая операция /
конвенция» заранее, до прогона, лестница не использует. Это вопрос H3 предрегистрации: предсказывает
ли класс ловушки нужную форму.

## 3. Банк кейсов

Разбор всех наборов `tests/trap-skills/*`. `T` = `tests/trap-skills`. Число - прошлый итог базы без
скилла (k из n), по реестру и протоколам.

| Кейс | Набор, скилл | Род | Стек | Единица под ловушку | База | Вход |
| --- | --- | --- | --- | --- | --- | --- |
| E1 | ef-core | код | .NET | условие `IsOverdue` до материализации; трекинг read-only | 1/2 (заход 1, с поиском) | `T/dotnet-ef-core/inputs/{Model,OrderRepository}.cs` |
| E2 | ef-core | код, «ничего не ломать» | .NET | (в) `Single` при складе `null`; (а) split на карточке законен | 2/2 | то же |
| E3 | ef-core | код | .NET | граница `Kind=Utc` для `timestamptz` | 0/2 (заход 1) | то же |
| E4 | ef-core | код, **исполняемый** | .NET | (б) запись в `timestamp`; (в) каскад при soft-delete; (г) `Clear()` при required FK | 0/2 | то же + стенд `inputs/e4-harness/` |
| E5 | ef-core | код | .NET | concurrency, `FOR UPDATE`, алиас | 2/2 | то же |
| E6 | ef-core | код (миграция + CI) | .NET | `database update` на production | 1/2 (заход 1) | то же |
| E7 | ef-core | код | .NET | scope воркера, `Kind=Utc` | 1/2 (заход 1) | то же |
| R | ef-core | ревью | .NET | D1-D9, K1; вне скилла O1; приманки B1 (`AsSplitQuery`), B2 | 8/9 (D3 0/2) | `T/dotnet-ef-core/inputs/review/` |
| L1-L8 | linq | код | .NET | L5 - дедуп входа | L5 3/4, прочие 2/2 | `T/removed/dotnet-linq-optimization/inputs/code/` |
| MR-A, MR-B | linq | ревью | .NET | MR-A: A1-A6, вне скилла X1, X2; MR-B: B1-B5, приманка D1 | MR-A 11/12, MR-B 5/5 | `.../inputs/review/` |
| K1 | di | код | .NET | ключ keyed-сервиса одной константой | 1/2 | `T/removed/dotnet-di/inputs/code/` |
| CFG | config-hygiene | ревью | .NET | K1-K9, приманки P1-P2, вне скилла O1-O3 | K1-K7 7/7, K8 0/2, K9 0/2 | `T/removed/dotnet-config-hygiene/inputs/review/` |
| perf A-D | performance-review | ревью | .NET, C - Python | K21 копия буфера (A 0/2), KD5 `CountAsync > 0` (D 0/2) | прочее 2/2 (opus) | `T/performance-review/inputs/review-{a,b,c,d}/` |
| FV-A/B/C | fact-verification | ревью, ADR | .NET, Python, ADR | KA1-3, KB1-2, KC1-3; приманки PA1-2, PB1, PC1; вне скилла OA, OB, OC | контроль 10/16 | `T/fact-verification/inputs/{review-a,review-b,adr-c}/` |

Ключи лежат в README наборов, адреса с номерами строк - в PREREG.

Наблюдения по банку:

- Исполняемая проверка есть только у E4 (стенд на Postgres). Остальные входы без csproj или
  намеренно не собираются, во всех промптах сборка запрещена. Код судится чтением по ключу.
- Целого кейса «верный исход - ничего не менять» нет. Ближе всех E2 и приманки внутри ревью.
- Класс C (конвенция) беден: E6 (база только из захода 1 с поиском), K1, K8 и K9 (обе minor).
- Класс D: у регрессии `Restrict` (2.7.0) нет исходного текста, ветка слита squash-ем. Опора -
  E2(в), приманка R-B1, `Chunk` в L5 по ловушке `Contains`, ловушка `required` в config-hygiene.
- Python - только FV-B и perf C (у perf C провала базы нет).
- Протокол PR #280: каталоги `runs/E4-x1`, `runs/E4-x2` - прогоны редакции 4g (в `_answer.md` путь
  `E4-X3`); редакция из промпта `E4-X1`/`X2` - черновик v31 («каскад в БД и удаление сирот в
  коде»), её выходы в репозиторий не положены. В этой ветке не правится.

Старые тексты для генерации F5: `T/dotnet-ef-core/inputs/SKILL-2.6.2.md` (28 триад),
`T/removed/dotnet-linq-optimization/inputs/SKILL-2.3.1.md` (16),
`T/removed/dotnet-config-hygiene/inputs/SKILL-1.3.1.md` (10),
`T/fact-verification/inputs/SKILL-1.3.0.md` (7), `T/performance-review/inputs/SKILL-1.0.1.md` (24),
di 1.1.1 - `git show 909011ba^:plugins/skills/dex-skill-dotnet-di/skills/dotnet-di/SKILL.md` (12).

### Факты, сверенные для форм F2-F4

| Факт | Источник | Сверено |
| --- | --- | --- |
| С Npgsql 6 `DateTime` без явного типа - `timestamptz`, `Kind=Utc` в `timestamp` бросает | <https://www.npgsql.org/efcore/release-notes/6.0.html> | 28.09.2026 (прошлая сессия) |
| Разрыв required-связи при `Restrict` / `ClientSetNull` - `InvalidOperationException` | <https://learn.microsoft.com/ef/core/saving/cascade-delete> | 28.09.2026 (прошлая сессия) |
| Модификатор `required` «doesn't relate to the validation source generation feature» | <https://learn.microsoft.com/dotnet/core/extensions/options-validation-generator> | 28.09.2026 |
| EF Core 8 передаёт список `Contains` одним параметром; Npgsql: `arrayNonColumn.Contains(element)` -> `element = ANY(arrayNonColumn)` | <https://learn.microsoft.com/ef/core/what-is-new/ef-core-8.0/whatsnew>, <https://www.npgsql.org/efcore/mapping/array.html> | 28.09.2026 |

## 4. Угрозы валидности прошлых прогонов

| Угроза | Что было | Чем закрывается здесь |
| --- | --- | --- |
| Подача | Скилл давался путём к файлу в задании, `Skill` запрещён. Потребители (`dotnet-coder`, `dotnet-ef-specialist`) грузят скилл через `skills:` агента. Активация `norm-writing` через плагин - 0/2 | Основная ячейка - путь (сравнимость с прошлым); отдельная ячейка - плагин через `--plugin-dir` и Skill tool |
| Число прогонов | По 2 на ячейку; 1/2 и 2/2 неразличимы (95% CI Уилсона для 2/2 - 34-100%) | n=4 на ячейку, решение по пулу класса |
| Тир | Только sonnet (performance-review - только opus) | sonnet основной, opus - репликация, haiku - по решению пользователя |
| Effort | Не фиксировался: у sonnet по умолчанию `high`, у opus 5.5 - `medium` | `--effort` задаётся явно и пишется в meta.json |
| Оценка | Ключи и вердикты ставил автор прогона, условие было видно | Ключ до прогонов, прогоны под случайными id, таблица «id -> условие» закрыта до конца оценки |
| Стек | Почти только .NET; Python - в fact-verification и performance-review C | Не меньше одного кейса не на .NET |
| Поиск | Заходы 1-3 - с предписанием поиска, заход 4 - без | Поиск - отдельный фактор, ячейка D |
| Загрязнение базы | Проверялось один раз | init-событие каждого прогона: `skills`, `plugins`, `model` |
| Облачные скиллы | В `~/.claude/skills/synced` лежат `deep-research`, `docx` и др. | В ячейках без Skill tool `Skill` запрещён; список `skills` из init пишется в meta.json |
| Отчёт исполнителя | Субагент K1-C2 описал литералы, в коде стояли константы | Оценка по коду и выходу, не по тексту ответа |
| Неверный ключ | E2 «голый `SingleOrDefault`»: мина кейса и ключ захода расходились | Ключ с исходами «засчитано / провал / спорно»; спорное - отдельной строкой |
