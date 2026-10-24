Directory.Build.props:6 - NU1902;NU1903 в NoWarn глушат предупреждения аудита уязвимостей, при TreatWarningsAsErrors сборка не упадёт на пакетах с известными уязвимостями, цель BILL-59 не выполнена - blocker
Directory.Build.props:3 - NuGetAuditMode не задан (по умолчанию аудит только прямых зависимостей), транзитивные уязвимые пакеты не обнаруживаются и пройдут в main - major
.github/workflows/billing.yml:19 - `dotnet list package --vulnerable` без --include-transitive и без проверки вывода: команда завершается с кодом 0 даже при находках, шаг ничего не останавливает - blocker
.github/workflows/billing.yml:18 - continue-on-error: true у шага тестов: падающие тесты не ломают CI, требование «падение тестов останавливает» не выполнено - blocker
.github/workflows/billing.yml:18 - покрытие только собирается (XPlat Code Coverage), порога 70% строк нет, просадка покрытия не будет остановлена - major
Directory.Build.props:9 - NsDepCop подключён, но файла config.nsdepcop (правило «Domain ни от чего не зависит») в репозитории нет: проверка слоёв ничего не проверяет, зависимость Domain от Infrastructure пройдёт сборку - blocker
.editorconfig:11 - severity NSDEPCOP01 = error при отсутствии конфигурации слоёв создаёт ложное чувство контроля - minor
Directory.Build.props:4 - AnalysisMode=Recommended в свойствах проекта вместе с bulk-настройкой category-Security/Reliability в .editorconfig: эти механизмы конфликтуют, severity категорий может не примениться и правила безопасности/надёжности не станут error - major
Directory.Build.props:6 - в NoWarn глушатся CA1031, CA1062, CA2007 и др. глобально без обоснования, часть из них категории Design/Reliability, обещанной строгости это противоречит - minor
src/Billing.Api/Infrastructure/Ledger/LedgerOutboxDispatcher.cs:6 - `#pragma warning disable CA2000` на весь файл без restore: скроет реальные утечки IDisposable в будущем коде файла, причина не указана - major
src/Billing.Api/Infrastructure/Persistence/InMemoryInvoiceRepository.cs:1 - `#pragma warning disable CA1812` на весь файл без restore, при этом в InMemoryOutbox то же подавляется атрибутом с Justification: непоследовательно, подавление не ограничено - minor
src/Billing.Api/Infrastructure/Persistence/InMemoryInvoiceRepository.cs:6 - класс из public сделан internal ради подавления-обхода CA1812, изменение API/видимости вне задачи сборки; тесты и другие сборки больше не видят тип - minor
src/Billing.Api/Infrastructure/Persistence/InMemoryOutbox.cs:6 - то же: видимость сужена (public → internal) в MR про сборку, плюс подавление CA1812 вместо корректного решения - minor
.github/workflows/billing.yml:3 - триггеры push и pull_request без фильтров: на каждый коммит PR-ветки сборка запускается дважды - minor
