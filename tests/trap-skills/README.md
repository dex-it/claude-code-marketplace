# Испытания trap-skill живым прогоном

Класс наборов: судится поведение исполнителя с ловушками скилла против того же исполнителя без
них. Метод - [«Сжатие по свидетельству»](../README.md#метод-сжатие-по-свидетельству): единица
остаётся, только если без неё прогон проваливается. Исход каждого набора - строка в реестре
прогонов [`tests/README.md`](../README.md#реестр-прогонов).

Общее для наборов:

- исполнитель - sonnet при любых потребителях скилла (`tests/README.md`, «Метод»; модель полным ID
  и effort - в протоколе), субагент с запретом `Skill` tool, чтения вне рабочего каталога и сборки; прогон со скиллом подаёт копию `SKILL.md` путём;
- вход копируется из `inputs/` в каталог вне репозитория, один каталог на прогон;
- имя ловушки в задании не звучит; ключ засеянных дефектов исполнителю не показывается;
- в ключе, кроме дефектов под ловушки, стоят приманки (находка по ним ложная) и дефекты вне скилла:
  по ним видно, сужает ли скилл охват ревью.

`<набор>/sources.md` - основания пунктов, пришедших из `/mr-apply`: MR, триада, самооценка анализатора. По ним строится кейс, когда пункт идёт в заход сжатия.

`_projects/` - общие мини-проекты нескольких наборов (`billing` - группы 0-1 и заход «инструкции и гайды проекта» набора codebase-conventions (#341; ветки `guides-base`, `overdue-list`, `customer-invoices`), `meridian` - заход «большой репозиторий» набора codebase-conventions (#311; генератор, результат в репозиторий не входит), `parcel` - группа 2.4, часть «тесты», `shipping` - группа 2.4b и имитация стенда (кейсы K6-K8 группы 4.7), `ordering` - группа 4.7 (observability, merge-conflict-resolution, exploratory-testing, deep-audit, tech-audit), `loyalty` - группа 3.2, корпус требований, `rooms` - группа 3.1, требования фичи, `bookings` - группа 4.2, ASP.NET Core и контракт OpenAPI, `classmate` - группа 4.8, `diag` - группа 4.6, Docker-лаборатория диагностики, продуктовые документы и история ревью, `shelfwatch` - группа 4.5, Python ML): `setup.sh` разворачивает git-репозиторий прогона, README проекта - ключ для судьи, исполнителю не подаётся.

`removed/` - наборы снятых скиллов: скилла в каталоге нет, набор хранит свидетельство снятия и не
перезапускается.

| Набор | Скилл | Заход | Итог |
|---|---|---|---|
| [fact-verification](fact-verification/README.md) | `dex-skill-fact-verification` 1.3.0, 2.0.0, 2.1.0 | ревью кода и ADR; звенья каскада; факт в коде проекта | 7 ловушек -> чек-лист из 5 пунктов; 2.1.0 - отрицательный факт с исходом |
| [codebase-conventions](codebase-conventions/README.md) | `dex-skill-codebase-conventions` 1.10.0, 1.12.0, 1.13.0 | ревью, фича; большой репозиторий (Meridian); инструкции и гайды (Billing) | 17 ловушек, граница и гейт -> чек-лист из 9 названий (1.11.0); ось 6 ADR и гейт сняты контролем на большом репозитории -> 1.13.0, 6 пунктов; пункт про свод остаётся названием; пункт об инструкциях и гайдах проекта снят контролем 15/15 -> 1.14.0, 5 пунктов |
| [review-evidence](review-evidence/README.md) | `dex-skill-review-evidence` 1.9.1 | ревью | 15 ловушек -> process-skill: «Намерение» и «Порог уверенности» |
| [testability](testability/README.md) | `dex-skill-testability` 1.1.2 | ревью (S2, S4) | 11 ловушек и чек-лист -> пункт-признак и `Guid.NewGuid()` (открыто до кейса) |
| [performance-review](performance-review/README.md) | `dex-skill-performance-review` 1.0.1 | ревью | 24 ловушки и чек-лист -> чек-лист; 1.2.0 - четыре пункта (контроль на sonnet medium) |
| [review-threads](review-threads/README.md) | `dex-skill-review-threads` 1.1.0 | доставка ревью в MR (заглушка хостинга) | 13 единиц -> process-skill 2.0.0: форма, жизненный цикл, запись; glab - ступень 2 |
| [review-step-by-step](review-step-by-step/README.md) | `dex-skill-review-step-by-step` 1.4.2 | разбор замечаний с оператором по ходам | 21 единица -> process-skill 2.0.0: порядок, гейты, финал |
| [dotnet-ef-core](dotnet-ef-core/README.md) | `dex-skill-dotnet-ef-core` 2.6.2 | поручения на код, ревью | 28 ловушек -> 5 -> чек-лист; 3.1.0 - два пункта шагом 3 |
| [removed/dotnet-linq-optimization](removed/dotnet-linq-optimization/README.md) | `dex-skill-dotnet-linq-optimization` 2.3.1 | поручения на код, ревью | снят |
| [removed/dotnet-config-hygiene](removed/dotnet-config-hygiene/README.md) | `dex-skill-dotnet-config-hygiene` 1.3.1 | ревью | снят |
| [removed/dotnet-di](removed/dotnet-di/README.md) | `dex-skill-dotnet-di` 1.1.1 | поручение на код (K1) | снят; keyed-сервисы -> `dotnet-api-development` 2.6.0, сняты в 2.7.0: K1 перемерен, контроль 2/2 |
| [removed/owasp-security](removed/owasp-security/README.md) | `dex-skill-owasp-security` 1.3.2 | ревью (S1, S2) | снят; multi-tenancy задним числом - названием в оси Security агентов ревью |
| [removed/no-loose-ends](removed/no-loose-ends/README.md) | `dex-skill-no-loose-ends` 1.0.0 | ревью (S1, S2, S3), автор (F1) | снят; TODO без тикета, отключённый тест, debug-вывод - названиями в осях агентов ревью |
| [removed/output-hygiene](removed/output-hygiene/README.md) | `dex-skill-output-hygiene` 1.2.0 | текст для человека: ревью (H1), ответ в тред (H2) | снят; длинное тире вне набора и «ответ не с результата» - открыто |
| [solid](solid/README.md) | `dex-skill-solid` 1.6.1 | ревью (A0, A1, A4); общий заход группы 1.2 | 16 ловушек и чек-лист -> 4 пункта: 1 признак, 3 названия |
| [ddd](ddd/README.md) | `dex-skill-ddd` 1.6.2 | ревью (A1, A2, A3) | 27 ловушек и чек-лист -> 10 названий |
| [removed/clean-architecture](removed/clean-architecture/README.md) | `dex-skill-clean-architecture` 1.4.1 | ревью (A2) | снят |
| [removed/microservices](removed/microservices/README.md) | `dex-skill-microservices` 1.2.1 | ревью (A3), проектирование (D1, D2, D3) | снят |
| [removed/distributed-resilience](removed/distributed-resilience/README.md) | `dex-skill-distributed-resilience` 1.0.1 | ревью (A3), проектирование (D2) | снят; R-f - названием в Phase 4 `architect`, `architect-dotnet` |
| [removed/git-workflow](removed/git-workflow/README.md) | `dex-skill-git-workflow` 1.2.1 | автор: коммит и push (W); повторное ревью (C, CB) | снят; конвенции - в свод правил проекта |
| [dotnet-async-patterns](dotnet-async-patterns/README.md) | `dex-skill-dotnet-async-patterns` 2.2.1 | код (G0, G1, G2), ревью (RV-A); общий заход группы 2.1 | 18 ловушек и чек-лист -> 1 название; A5 удалена |
| [dotnet-validation](dotnet-validation/README.md) | `dex-skill-dotnet-validation` 1.2.1 | код (G3), ревью (RV-V, RV0) | 19 ловушек и чек-лист -> 3 названия; V14 снята |
| [dotnet-logging](dotnet-logging/README.md) | `dex-skill-dotnet-logging` 2.4.1 | ревью (RV-L1, RV-L2) | 20 ловушек и чек-лист -> 4 названия |
| [removed/dotnet-resources](removed/dotnet-resources/README.md) | `dex-skill-dotnet-resources` 1.0.1 | ревью (RV-R) | снят |
| [dotnet-code-quality](dotnet-code-quality/README.md) | `dex-skill-dotnet-code-quality` 1.1.1 | код (G4), ревью (RV-Q) | 15 ловушек и чек-лист -> 2 названия; Q4, Q11, Q13 сняты по вреду |
| [dotnet-testing-patterns](dotnet-testing-patterns/README.md) | `dex-skill-dotnet-testing-patterns` 2.0.1 | код (G-T, G0), ревью (RV-T, RV0) | 7 ловушек -> 2 названия |
| [dotnet-api-development](dotnet-api-development/README.md) | `dex-skill-dotnet-api-development` 2.6.1 | код (G-A), ревью (RV-A, RV0) | 20 ловушек и чек-лист -> 9 названий; D10, D14 возвращены |
| [dotnet-csproj-hygiene](dotnet-csproj-hygiene/README.md) | `dex-skill-dotnet-csproj-hygiene` 1.3.2 | код (G-P), ревью (RV-C) | 14 ловушек и чек-лист -> 5 названий; NU1603 снят по вреду |
| [dotnet-resilience](dotnet-resilience/README.md) | `dex-skill-dotnet-resilience` 1.1.1 | код (G-R), ревью (RV-S); общий заход группы 2.2 | 12 ловушек и чек-лист -> 6 названий и H1; S11 снят по вреду |
| [removed/dotnet-caching](removed/dotnet-caching/README.md) | `dex-skill-dotnet-caching` 1.0.2 | код (G-H), ревью (RV-H) | снят; H1 - в `dotnet-resilience` |
| [ts-nodejs-api](ts-nodejs-api/README.md) | `dex-skill-ts-nodejs-api` 2.0.1 | поручение на код (K1), ревью (R1); общий заход группы 2.3 | 15 ловушек и чек-лист -> 1 пункт-название (env при старте) |
| [react](react/README.md) | `dex-skill-react` 1.1.1 | поручение на код (K2), ревью (R2) | 16 ловушек и чек-лист -> 2 пункта-названия |
| [playwright](playwright/README.md) | `dex-skill-playwright` 1.0.1 | e2e по коду и конфигу (K4, K5) | 17 ловушек и чек-лист -> 2 пункта-названия и 2 H3 как написаны (W12, W13) |
| [ts-vitest-jest](ts-vitest-jest/README.md) | `dex-skill-ts-vitest-jest` 2.0.1, 2.1.0, 2.2.0 | unit-тесты (K3), расчёт стоимости (K3D, #321), «ничего не менять» (K3N, не прогонялся) | 10 ловушек и чек-лист -> 4 H3 как написаны -> 1 H3 (V1); V3, V9, V10 сняты контролем K3D 4/4 (#321) |
| [removed/ts-patterns](removed/ts-patterns/README.md) | `dex-skill-ts-patterns` 2.0.1 | кейсы соседей (K0-K3, R1, R2) | снят; внешние данные через `as` без проверки - закрыты строкой Boundaries `ts-fullstack-assistant` («`unknown` + type guard») |
| [removed/test-design](removed/test-design/README.md) | `dex-skill-test-design` 1.6.0 | тестописатель с нормой показа красным и без (TW, TW0), ревью записей red-run (TR), баг (BR); мини-проект `parcel` | снят; порог «Negative >= 50%» - шаг 0 |
| [integration-boundary](integration-boundary/README.md) | `dex-skill-integration-boundary` 1.0.0 | автор: подключение перевозчика (IB), поиск на SQLite (IBF) | 7 ловушек и чек-лист -> 3 названия; слой сборки - открыто |
| [bug-reproduction](bug-reproduction/README.md) | `dex-skill-bug-reproduction` 1.0.0 | воспроизведение и фикс (BR) | 8 ловушек и чек-лист -> 1 название (heisenbug, открыто) |
| [removed/contract-drift](removed/contract-drift/README.md) | `dex-skill-contract-drift` 1.1.0 | QA на стенде (CD, CDT) | снят; cd-schema - открыто, #303 |
| [root-cause-analysis](root-cause-analysis/README.md) | `dex-skill-root-cause-analysis` 1.0.0 | причина 500 и исправление (K1), ничего не менять (K0), инцидент и баги QA (K2, K4); общий заход группы 2.4b | 8 ловушек и чек-лист -> process-skill 2.0.0: порядок из трёх шагов |
| [change-correlation](change-correlation/README.md) | `dex-skill-change-correlation` 1.0.1 | инцидент на общем стенде (K2), регрессия между релизом и develop (K3) | 8 ловушек и чек-лист -> process-skill 2.0.0: порядок; образ на стенде - фраза по провалу n1 |
| [post-merge-remediation](post-merge-remediation/README.md) | `dex-skill-post-merge-remediation` 1.0.1 | баги QA после мерджа, общий стенд, оператор по ходам (K4) | 6 ловушек -> process-skill 2.0.0: порядок и гейты; гейт выката по свидетельству |
| [scalability](scalability/README.md) | `dex-skill-scalability` 1.0.1 | проектирование (D5, D6, D7; SC7 в D1, SC3, SC5 в D3); мини-проект `postline`, общий заход группы 4.1 | 10 ловушек -> 1 название |
| [adr-quality](adr-quality/README.md) | `dex-skill-adr-quality` 2.4.0 | письмо ADR (W1-W5), ревью (R1, R0A3) | 14 ловушек -> 6 названий; AQ8 - название, форма выше не найдена (ступени 3-4) |
| [design-quality](design-quality/README.md) | `dex-skill-design-quality` 1.1.2 | ревью дизайна (R2), автор дизайна (D1-D5) | 9 ловушек -> 1 название; DQ3 - открыто |
| [plan-quality](plan-quality/README.md) | `dex-skill-plan-quality` 1.0.1 | автор плана (P1), ревью плана (R3, R0P3) | 12 ловушек -> 2 названия; PQ6 - в оракуле форма не найдена (ступени 1-4), закрыт формой автора `implementation-plan` |
| [implementation-plan](plan-quality/README.md#форма-автора-dex-skill-implementation-plan-100-pq6-вне-оракула) | `dex-skill-implementation-plan` 1.0.0 (тело - редакция 1.0.3) | автор плана (P1; P2 - «ничего не менять» для формы); живёт в протоколе `plan-quality` | новый process-skill: поля шага и параллельность по предмету правки; 4 редакции, принята 1.0.3 (PQ6 4/4 против 1/2 контроля) |
| [removed/cap-consistency](removed/cap-consistency/README.md) | `dex-skill-cap-consistency` 1.1.1 | проектирование (D2, D1), ревью дизайна (R2) | снят |
| [removed/capacity-planning](removed/capacity-planning/README.md) | `dex-skill-capacity-planning` 1.0.1 | ёмкость (C1), проектирование (D1, D4, D5) | снят |
| [removed/reference-architectures](removed/reference-architectures/README.md) | `dex-skill-reference-architectures` 1.0.2 | проектирование (D1-D4) | снят |
| [removed/tech-evaluation](removed/tech-evaluation/README.md) | `dex-skill-tech-evaluation` 1.0.1 | выбор технологии (T1-T3) | снят |
| [decision-log](decision-log/README.md) | `dex-skill-decision-log` 1.6.1 | поручения аналитику требований (K0-K6, N1, N2); общий заход группы 3.2 | 18 ловушек -> process-skill 2.0.0: процедура владельца, запись, утрата |
| [unit-identity](unit-identity/README.md) | `dex-skill-unit-identity` 2.1.2 | K1, K3, K4, K5, N1 | 16 ловушек -> process-skill 3.0.0: ключ и дубль, номера указателем, правка |
| [artifact-naming](artifact-naming/README.md) | `dex-skill-artifact-naming` 1.3.2 | N1, N2, K2 | 10 ловушек -> process-skill 2.0.0: граница конвенции и норма имени |
| [requirement-quality](requirement-quality/README.md) | `dex-skill-requirement-quality` 1.3.1 | w1-w4, r1-r5, c0, g1 (общий набор группы 3.1, `_projects/rooms`) | 10 ловушек -> process-skill 2.0.0: «Противоречие», вводная оракула, один пункт; задача #119: проектные решения в FR/NFR (r6) контролем 20/20, пункт не вводится |
| [requirement-set-quality](requirement-set-quality/README.md) | `dex-skill-requirement-set-quality` 1.7.0 | r2, r5, c0 | 20 ловушек -> process-skill 2.0.0: рамка пунктом, 3 ловушки как написаны, «Готовность набора» |
| [nfr](nfr/README.md) | `dex-skill-nfr` 1.2.0 | w2, w2n, r1, r2 | 15 ловушек -> 3 пункта |
| [functional-requirements](functional-requirements/README.md) | `dex-skill-functional-requirements` 1.2.0 | w2, w2n, r1, c0 | 12 ловушек -> 1 пункт с исходом |
| [use-case-quality](use-case-quality/README.md) | `dex-skill-use-case-quality` 1.0.0 | w3, r3 | 14 ловушек -> 8 пунктов-названий; принят пункт из `use-cases` |
| [user-stories](user-stories/README.md) | `dex-skill-user-stories` 1.2.1 | w4, r4, r7 | 18 ловушек и чек-лист -> 4 пункта; задача #119 (INVEST): круговая зависимость историй контролем 1/5 -> пятый пункт, 2.1.0 |
| [removed/use-cases](removed/use-cases/README.md) | `dex-skill-use-cases` 1.0.2 | w3, r3 | снят; пункт - в `use-case-quality`, реконструкция - `usecase-analyst` |
| [removed/problem-specification](removed/problem-specification/README.md) | `dex-skill-problem-specification` 1.0.0 | инцидент по тикету QA (K5, `_projects/shipping`) | снят; норма - Phase 1 `incident-investigator` |
| [removed/api-specification](removed/api-specification/README.md) | `dex-skill-api-specification` 1.1.1 | контракт под требования (G-S); общий заход группы 4.2 | снят; S1, S4, S11 - вердикт двойников #327 |
| [api-spec-quality](api-spec-quality/README.md) | `dex-skill-api-spec-quality` 1.0.0 | ревью MR контракта (RV-Q), автор контракта (G-S), ничего не менять (N-Q, N-Q2, N-Q3 - не чисты) | 13 ловушек -> вводная и 5 названий; Q11 - дом норматив этапа |
| [api-testing](api-testing/README.md) | `dex-skill-api-testing` 1.1.1 | тесты по контракту (G-T), ничего не менять в `src/` (N-T) | 11 ловушек и чек-лист -> 1 название (тестовая база) |
| [api-documentation](api-documentation/README.md) | `dex-skill-api-documentation` 1.1.2 | Swagger к передаче (G-D), правка вне предмета (N0) | 9 ловушек и чек-лист -> 3 названия; A5, A8 - `unverifiable` |
| [kafka](kafka/README.md) | `dex-skill-kafka` 1.1.1, 1.2.0 | код (G-K), ревью (RV-K), N-G, N-RV; мини-проект `fulfil`; общий заход группы 4.3 | 10 ловушек -> 3 пункта: 2 названия и K8 с исходом |
| [rabbitmq](rabbitmq/README.md) | `dex-skill-rabbitmq` 1.1.1, 1.2.0 | код (G-B), ревью (RV-B) | 10 ловушек -> 3 названия; B4, B9 расходятся с `microservices` |
| [redis](redis/README.md) | `dex-skill-redis` 1.1.1, 1.2.0 | код (G-C), ревью (RV-C) | 12 ловушек и чек-лист -> 3 названия; C4 - дом `dotnet-resilience` |
| [mongodb](mongodb/README.md) | `dex-skill-mongodb` 1.1.1, 1.2.0 | код (G-M), ревью (RV-M) | 11 ловушек и чек-лист -> 4 названия |
| [elasticsearch](elasticsearch/README.md) | `dex-skill-elasticsearch` 1.1.1, 1.2.0 | код (G-E), ревью (RV-E) | 11 ловушек и чек-лист -> 2 названия |
| [doc-standards](doc-standards/README.md) | `dex-skill-doc-standards` 1.7.1 | автор спеки и CHANGELOG (W-DS), ревью PRD, спеки и ADR (R-DS); мини-проект `classmate`, общий заход группы 4.8 | 18 ловушек и чек-лист -> 3 пункта; конвенции оформления - в свод правил проекта |
| [product-discovery](product-discovery/README.md) | `dex-skill-product-discovery` 1.1.4 | план discovery (W-PD), ревью итогов (R-PD), «ничего не менять» (R0P) | 11 ловушек и чек-лист -> 7 пунктов; первый - на шаге 3 |
| [epic-planning](epic-planning/README.md) | `dex-skill-epic-planning` 1.1.1 | эпик и истории (W-EP), ревью плана квартала (R-BL), «ничего не менять» (R0P) | 11 ловушек и чек-лист -> 3 пункта с предметом и границей |
| [prioritization](prioritization/README.md) | `dex-skill-prioritization` 1.1.1 | приоритеты квартала (W-PR), R-BL, R0P | 11 ловушек и чек-лист -> 3 пункта и H3; HIPPO - на шаге 4 |
| [removed/agile](removed/agile/README.md) | `dex-skill-agile` 1.2.2 | W-EP, R-BL | снят; Water-Scrum-Fall - дубль детализации заранее `epic-planning` |
| [removed/bpmn](removed/bpmn/README.md) | `dex-skill-bpmn` 1.1.1 | модель по заметкам (W-BP), ревью модели (R-BP), «ничего не менять» (R0B) | снят; «Перегруженная диаграмма» - по вреду против 7PMG |
| [removed/karpathy-guidelines](removed/karpathy-guidelines/README.md) | `dex-skill-karpathy-guidelines` 1.1.1 | код по тикету (K1, K2), тикет об исправленном (K0) | снят |
| [removed/python-classical-ml](removed/python-classical-ml/README.md) | `dex-skill-python-classical-ml` 2.0.1, 2.1.0 | ревью (RV-ML), код (K-ML); общий заход группы 4.5, `_projects/shelfwatch` | снят: 14 ловушек -> 2 названия (PR #370), C9 и C10 сняты контролем по существу (n=4, стек на #370) |
| [rule-mining](rule-mining/README.md) | `dex-rulebook-miner` 2.3.1, скилл `rule-mining` | партия добычи по истории ревью (RM1), база - тело `rule-collector` | 18 ловушек -> пункт и H3 (RM-47, ступени 1, 3, 4); правлен перечень исходов `sources-ledger`, `no-rule:no-remark` (#364) |
| [rulebook-quality](rulebook-quality/README.md) | `dex-rulebook-miner` 2.3.1, оракул `rulebook-quality` | вердикт по своду (RQ1, RQ2), «ничего не менять» (RQ0), база - шаг 2 `/rulebook` и `project-rulebook` | 20 ловушек -> вводная с признаком блокирующей и 1 H3 (ступени 1-4) |
| [observability](observability/README.md) | `dex-skill-observability` 1.2.1 | код (OBSW), ревью (OBSR, OBS0); мини-проект `ordering`, общий заход группы 4.7 | 13 ловушек и чек-лист -> 4 названия; W9 снят по вреду на OBS0, возвращён с границей в стеке на #374 (1.4.0) |
| [merge-conflict-resolution](merge-conflict-resolution/README.md) | `dex-skill-merge-conflict-resolution` 2.0.1 | merge, rebase, чистое слияние (MC1, MC2, MC0) | протокол сохранён, 15 ловушек -> 7 названий |
| [stand-verification](stand-verification/README.md) | `dex-skill-stand-verification` 1.1.2 | приёмка на стенде (K7, K8, K9 «ничего не менять», `_projects/shipping`) | 11 ловушек -> 3 названия (V3, V10, V11) |
| [shared-stand-safety](shared-stand-safety/README.md) | `dex-skill-shared-stand-safety` 1.0.0 | инцидент на общем стенде (K6, K10 «ничего не менять») | сжатие до 3 названий (1.1.0) отменено после K10 (H1 3/4 на 1.0.0 против 0/4), скилл без изменений |
| [removed/exploratory-testing](removed/exploratory-testing/README.md) | `dex-skill-exploratory-testing` 1.0.1 | тестировщик (ET1, ET0) | снят |
| [removed/deep-audit](removed/deep-audit/README.md) | `dex-skill-deep-audit` 1.0.2 | аудит компонента (DA1, DA0) | снят; A6 -> ось `dotnet-runtime-diagnostician`, в стеке на #374 убрана и из оси (контроль 3/4) |
| [removed/tech-audit](removed/tech-audit/README.md) | `dex-skill-tech-audit` 1.0.2 | аудит RFC (TA1, TA0) | снят: потребителей нет |
| [python-pytorch](python-pytorch/README.md) | `dex-skill-python-pytorch` 2.0.1, 2.1.0 | ревью (RV-PT, RV-DDP), чистый MR (N0), чистая задача (N0K); общий заход группы 4.5, `_projects/shelfwatch` | 14 ловушек и чек-лист -> 1 пункт (`loss.item()` на батче, с фактом версии) |
| [python-tensorflow](python-tensorflow/README.md) | `dex-skill-python-tensorflow` 2.0.1, 2.1.0 | ревью (RV-TF); общий заход группы 4.5, `_projects/shelfwatch` | 15 ловушек и чек-лист -> 1 название (`map` без `num_parallel_calls`) |
| [python-computer-vision](python-computer-vision/README.md) | `dex-skill-python-computer-vision` 2.0.1, 2.1.0 | ревью (RV-CV); общий заход группы 4.5, `_projects/shelfwatch` | 13 ловушек и таблица -> 1 название (`Resize` одним числом на неквадратных кадрах) |
| [python-nlp-transformers](python-nlp-transformers/README.md) | `dex-skill-python-nlp-transformers` 2.0.1, 2.1.0 | ревью (RV-NLP), код (K-NLP); общий заход группы 4.5, `_projects/shelfwatch` | 16 ловушек и чек-лист -> 4 пункта (токенизация пачкой, прогрев с фактом версии, жадная генерация, динамическое int8 на CPU с фактом deprecated) |
| [python-ml-optimization](python-ml-optimization/README.md) | `dex-skill-python-ml-optimization` 2.0.1, 2.1.0 | ревью (RV-OPT, RV-DDP); общий заход группы 4.5, `_projects/shelfwatch` | 14 ловушек и таблица -> 1 название (`suggest_int` на диапазоне в сотни значений) |
| [python-project-hygiene](python-project-hygiene/README.md) | `dex-skill-python-project-hygiene` 1.0.0, 1.1.0, 1.2.0 | ревью (RV-HYG), код (K-HYG); общий заход группы 4.5, `_projects/shelfwatch` | 11 ловушек -> 5 названий -> 4 (H2 снята по существу, стек на #370): `ignore_missing_imports`, порог покрытия, `filterwarnings`, аудит зависимостей |
| [removed/docker](removed/docker/README.md) | `dex-skill-docker` 1.1.1 | Dockerfile с нуля (dk-w), системные пакеты (dk-a); мини-проект `depot`, общий заход группы 4.4 | снят; D7-curl - дефект «Правильно» |
| [kubernetes](kubernetes/README.md) | `dex-skill-kubernetes` 1.1.1 | манифесты с нуля (k-w), починка (k-f), разбор по `kubectl` (k-t) | 11 ловушек -> 3 названия (K1, K4, K7); ревизия 4 (стек на #368): K4 снят -> 2 названия (K1, K7), 1.3.0; ревизия 5 (ревью, раунд 4): K5 возвращён названием (контроль `k-w` 0/2 по букве ключа) -> K1, K5, K7 |
| [github-actions](github-actions/README.md) | `dex-skill-github-actions` 1.0.1 | workflow-ы (ga-w), кэш (ga-c) | 11 ловушек и чек-лист -> 1 название (GA11); GA3 снят по вреду |
| [gitlab-ci](gitlab-ci/README.md) | `dex-skill-gitlab-ci` 1.1.1 | `.gitlab-ci.yml` (gl-w) | 14 ловушек и чек-лист -> 1 название (GL9) |
| [jenkins](jenkins/README.md) | `dex-skill-jenkins` 1.0.1 | `Jenkinsfile` (j-w) | 11 ловушек и чек-лист -> 6 названий; J5, J9, J10 - `unverifiable` |
| [teamcity](teamcity/README.md) | `dex-skill-teamcity` 1.1.1 | `.teamcity/settings.kts` (tc-w) | 9 ловушек и чек-лист -> 2 названия (TC9, TC5 открыто) |
| [ci-gates](ci-gates/README.md) | `dex-skill-ci-gates` 1.0.0 | готовый CI и защита `main` (cg), ничего не менять (n-ci) | 8 ловушек -> 2 названия (G1, G7) |
| [managed-debug](managed-debug/README.md) | `dex-skill-managed-debug` 1.1.0, 1.2.0 | управляемый hang (d1), дамп (d3), медленный путь (p1), «ничего не менять» (n0); `_projects/diag`, общий заход группы 4.6 | 16 ловушек -> 13; сняты attach без CAP, Mini-дамп, `.Result`; остальное `unverifiable` |
| [core-dumps](core-dumps/README.md) | `dex-skill-core-dumps` 1.0.0 | core по build-id (n1), дамп (d3) | 13 ловушек -> 9; сняты четыре (двойники и build-id) |
| [native-debug](native-debug/README.md) | `dex-skill-native-debug` 1.0.0 | core (n1), живой процесс без `CAP_SYS_PTRACE` (n2) | 16 ловушек -> 10; сняты Yama, CAP, REPL, build-id, порядок аргументов, Apple Silicon (вне предмета) |
| [syscall-tracing](syscall-tracing/README.md) | `dex-skill-syscall-tracing` 1.0.0 | скрытый дочерний процесс (s1) | 14 ловушек -> 13; снят `-f` |
| [binary-inspection](binary-inspection/README.md) | `dex-skill-binary-inspection` 1.0.0 | недоверенные бинарники (b1), core (n1) | 16 ловушек -> 10; сняты ldd, nm -D, file, ilspycmd, strings, build-id |
| [perf-profiling](perf-profiling/README.md) | `dex-skill-perf-profiling` 1.0.0 | медленный .NET-путь (p1) | 13 ловушек -> 12; снята PerfMap |
