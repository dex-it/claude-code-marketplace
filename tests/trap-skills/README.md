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
| [performance-review](performance-review/README.md) | `dex-skill-performance-review` 1.0.1 | ревью | 24 ловушки и чек-лист -> чек-лист; 1.2.0 - три пункта (контроль на sonnet medium) |
| [review-threads](review-threads/README.md) | `dex-skill-review-threads` 1.1.0 | доставка ревью в MR (заглушка хостинга) | 13 единиц -> process-skill 2.0.0: форма, жизненный цикл, запись; glab - ступень 2 |
| [review-step-by-step](review-step-by-step/README.md) | `dex-skill-review-step-by-step` 1.4.2 | разбор замечаний с оператором по ходам | 21 единица -> process-skill 2.0.0: порядок, гейты, финал |
| [dotnet-ef-core](dotnet-ef-core/README.md) | `dex-skill-dotnet-ef-core` 2.6.2 | поручения на код, ревью | 28 ловушек -> 5 -> чек-лист; 3.1.0 - два пункта шагом 3 |
| [removed/dotnet-linq-optimization](removed/dotnet-linq-optimization/README.md) | `dex-skill-dotnet-linq-optimization` 2.3.1 | поручения на код, ревью | снят |
| [removed/dotnet-config-hygiene](removed/dotnet-config-hygiene/README.md) | `dex-skill-dotnet-config-hygiene` 1.3.1 | ревью | снят |
| [removed/dotnet-di](removed/dotnet-di/README.md) | `dex-skill-dotnet-di` 1.1.1 | поручение на код (K1) | снят; keyed-сервисы -> `dotnet-api-development` |
| [removed/owasp-security](removed/owasp-security/README.md) | `dex-skill-owasp-security` 1.3.2 | ревью (S1, S2) | снят; multi-tenancy задним числом - названием в оси Security агентов ревью |
| [removed/no-loose-ends](removed/no-loose-ends/README.md) | `dex-skill-no-loose-ends` 1.0.0 | ревью (S1, S2, S3), автор (F1) | снят; TODO без тикета, отключённый тест, debug-вывод - названиями в осях агентов ревью |
| [removed/output-hygiene](removed/output-hygiene/README.md) | `dex-skill-output-hygiene` 1.2.0 | текст для человека: ревью (H1), ответ в тред (H2) | снят; длинное тире вне набора и «ответ не с результата» - открыто |
| [removed/git-workflow](removed/git-workflow/README.md) | `dex-skill-git-workflow` 1.2.1 | автор: коммит и push (W); повторное ревью (C, CB) | снят; конвенции - в свод правил проекта |
