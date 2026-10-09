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

`_projects/` - общие мини-проекты нескольких наборов: `setup.sh` разворачивает git-репозиторий прогона, README проекта - ключ для судьи, исполнителю не подаётся.

`removed/` - наборы снятых скиллов: скилла в каталоге нет, набор хранит свидетельство снятия и не
перезапускается.

| Набор | Скилл | Заход | Итог |
|---|---|---|---|
| [fact-verification](fact-verification/README.md) | `dex-skill-fact-verification` 1.3.0, 2.0.0, 2.1.0 | ревью кода и ADR; звенья каскада; факт в коде проекта | 7 ловушек -> чек-лист из 5 пунктов; 2.1.0 - отрицательный факт с исходом |
| [codebase-conventions](codebase-conventions/README.md) | `dex-skill-codebase-conventions` 1.10.0 | ревью, фича | 17 ловушек, граница и гейт -> чек-лист из 9 названий |
| [review-evidence](review-evidence/README.md) | `dex-skill-review-evidence` 1.9.1 | ревью | 15 ловушек -> process-skill: «Намерение» и «Порог уверенности» |
| [testability](testability/README.md) | `dex-skill-testability` 1.1.2 | ревью (S2, S4) | 11 ловушек и чек-лист -> пункт-признак и `Guid.NewGuid()` (открыто до кейса) |
| [performance-review](performance-review/README.md) | `dex-skill-performance-review` 1.0.1 | ревью | 24 ловушки и чек-лист -> чек-лист; 1.2.0 - четыре пункта (контроль на sonnet medium) |
| [review-threads](review-threads/README.md) | `dex-skill-review-threads` 1.1.0 | доставка ревью в MR (заглушка хостинга) | 13 единиц -> process-skill 2.0.0: форма, жизненный цикл, запись; glab - ступень 2 |
| [review-step-by-step](review-step-by-step/README.md) | `dex-skill-review-step-by-step` 1.4.2 | разбор замечаний с оператором по ходам | 21 единица -> process-skill 2.0.0: порядок, гейты, финал |
| [dotnet-ef-core](dotnet-ef-core/README.md) | `dex-skill-dotnet-ef-core` 2.6.2 | поручения на код, ревью | 28 ловушек -> 5 -> чек-лист; 3.1.0 - два пункта шагом 3 |
| [removed/dotnet-linq-optimization](removed/dotnet-linq-optimization/README.md) | `dex-skill-dotnet-linq-optimization` 2.3.1 | поручения на код, ревью | снят |
| [removed/dotnet-config-hygiene](removed/dotnet-config-hygiene/README.md) | `dex-skill-dotnet-config-hygiene` 1.3.1 | ревью | снят |
| [removed/dotnet-di](removed/dotnet-di/README.md) | `dex-skill-dotnet-di` 1.1.1 | поручение на код (K1) | снят; keyed-сервисы -> `dotnet-api-development` |
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
| [dotnet-code-quality](dotnet-code-quality/README.md) | `dex-skill-dotnet-code-quality` 1.1.1 | код (G4), ревью (RV-Q) | 15 ловушек и чек-лист -> 5 названий |
