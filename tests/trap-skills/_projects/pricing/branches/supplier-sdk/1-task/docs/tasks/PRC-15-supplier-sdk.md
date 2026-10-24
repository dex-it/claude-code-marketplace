# PRC-15: клиент Supplier API отдельным пакетом

Клиент Supplier API нужен ещё сервису закупок (другой репозиторий, .NET 8). Вынести клиента в
библиотеку `src/Pricing.Suppliers`, которую CI публикует пакетом `Pricing.Suppliers` 1.0.0 во
внутренний NuGet-фид; наш сервис пользуется той же библиотекой через ссылку на проект.

Публичный API пакета контролирует анализатор `Microsoft.CodeAnalysis.PublicApiAnalyzers`: любое
изменение публичных типов видно в PR правкой `PublicAPI.Shipped.txt` / `PublicAPI.Unshipped.txt`.

Сборка решения и тесты остаются зелёными.
