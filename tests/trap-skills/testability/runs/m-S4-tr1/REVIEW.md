src/Billing.Api/Application/Installments/InstallmentScheduleBuilder.cs:10 - дата разбиения берётся по TimeZoneInfo.Local, а не по Москве (серверы в UTC): с 21:00 до 24:00 UTC дата на сутки раньше МСК, все сроки сдвигаются, а тест Build_MonthEnd проходит только на машине в МСК - клиентам неверные сроки платежей, в CI тест красный -
severity (blocker)
src/Billing.Api/Application/Installments/MoneySplit.cs:12 - остаток от деления кладётся в последний платёж, по задаче BILL-25 должен быть в первый; тест Split_RemainderGoesToOnePayment закрепляет ошибку (333,333,334) - суммы платежей расходятся со спецификацией и ожиданиями бухгалтерии -
severity (major)
src/Billing.Api/Application/Handlers/Invoices/ScheduleInstallmentsHandler.cs:28 - письмо в бухгалтерию отправляется после SaveAsync без обработки ошибок: сбой SMTP даёт клиенту 500, хотя рассрочка уже сохранена, повтор запроса получит InvoiceInvalidState - бэк-офис не знает, что график создан -
severity (major)
src/Billing.Api/Application/Installments/InstallmentAuditSampler.cs:14 - доля выборки читается из переменной окружения напрямую, значение не валидируется (>1, <0, NaN), подставить в тесте нечего - долю не проверить, при ошибке в настройке письма уходят по всем рассрочкам или не уходят вовсе -
severity (major)
src/Billing.Api/Application/Installments/InstallmentAuditSampler.cs:21 - Random.Shared внутри логики без шва, а AuditMailer - sealed класс без интерфейса, с SmtpClient внутри: выборку нельзя проверить unit-тестом, тест по доле выборки требует реальной почты и случайности -
severity (major)
src/Billing.Api/Application/Installments/InstallmentScheduleBuilder.cs:11 - праздничный календарь читается с диска через File и AppContext.BaseDirectory при каждом вызове, подменить нельзя: тесты зависят от реального holidays.txt, отсутствие или битая строка файла даёт 500 на каждом запросе, праздники в тестах не проверяются -
severity (major)
src/Billing.Api/Application/Installments/InstallmentScheduleBuilder.cs:18 - Guid.NewGuid() внутри Build, результат попадает в проверяемый график: id платежей нельзя зафиксировать в тесте -
severity (minor)
src/Billing.Api/Application/Handlers/Invoices/ScheduleInstallmentsValidator.cs:11 - максимум берётся из статического BillingConfig.Current (глобальное изменяемое состояние): тесты, меняющие его, влияют друг на друга при параллельном запуске xunit, валидатор не получает настройку через конструктор/IOptions -
severity (major)
src/Billing.Api/calendar/holidays.txt:15 - календарь покрывает только до 2027-11-04, после этого срока выходные праздники молча не переносятся; нет проверки актуальности файла -
severity (minor)
src/Billing.Api/Application/Handlers/Invoices/ScheduleInstallmentsHandler.cs:16 - нет проверки, что сумма счёта не меньше Count минорных единиц: при малой сумме часть платежей получается нулевой -
severity (minor)
tests/Billing.Tests/InstallmentScheduleTests.cs:60 - тест выборочного контроля пропущен (Skip), доля выборки не покрыта вопреки требованию задачи; нет тестов праздников и остатка копеек в первый платёж -
severity (major)
