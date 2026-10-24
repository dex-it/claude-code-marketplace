Задача FUL-16 выполнена в рабочем дереве, ничего не закоммичено. Сборки и тестов не было, так что код не проверен компилятором.

Изменённые и новые файлы:
- `src/Fulfil/Domain/VolumeDiscount.cs` (новый): правило скидки.
- `src/Fulfil/Domain/Order.cs`: добавлено `TotalWithDiscount`.
- `Directory.Packages.props`: добавлены `Microsoft.NET.Test.Sdk` 17.14.1, `xunit` 2.9.3 и `xunit.runner.visualstudio` 3.1.4.
- `Fulfil.sln`: подключён тестовый проект.
- `tests/Fulfil.Tests/Fulfil.Tests.csproj` (новый).
- `tests/Fulfil.Tests/VolumeDiscountTests.cs` (новый): тесты порогов, округления и `Order`.

Решения:
- Правило вынесено в статический класс `VolumeDiscount` в домене. Пороги 10 000 и 50 000 включительно считаются от `Order.Total`, а `Order.Total` не менялся. Сумма со скидкой округляется вниз до копеек через `Math.Floor(x*100)/100`.
- Версии тестовых пакетов я выбрал по памяти и не проверял. CI может их не найти, тогда их нужно поправить.
