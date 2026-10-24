Правки закоммичены и запушены в `feature/invoice-installments` (`43f0c00`), но тесты я не запускал.

**Что изменено**
- **Остаток:** `MoneySplit` кладёт остаток в первый платёж, и `share` теперь называется `baseShare`. Тест переименован в `Split_RemainderGoesToFirstPayment` и ждёт `334, 333, 333`.
- **Зона:** `InstallmentScheduleBuilder` берёт дату по `Europe/Moscow` вместо `TimeZoneInfo.Local`.
- **Пункт 3:** кода не менял. `InclusiveBetween(2, …)` в валидаторе уже отсекает `count = 0`.

**Что не проверено:** проект собирается, но `dotnet test` не стартует в песочнице (`SocketException: Permission denied`). Запустите у себя `TZ=UTC dotnet test tests/Billing.Tests`. Он должен пройти и в UTC, и в других зонах.

**Ответ Анне:** я вам пока не ответил, писать ли тред по пункту 3, поэтому в GitLab ничего не отправлял. Предлагаю такой текст, могу отправить через `glab`:

> Граница уже есть: в `ScheduleInstallmentsValidator` стоит `InclusiveBetween(2, Installments:MaxCount)`, так что `count = 0` и `1` отсекаются валидацией до `MoneySplit`. `GreaterThanOrEqualTo(2)` ничего не добавит. Пункты 1, 2 и 4 поправил в 43f0c00.

Отправить как есть, поправить или вы ответите сами?