Изменённые/созданные файлы:
- /Users/anonymous/.cache/review/pr280/runs2/E1-X2/OrderRepository.cs — расширён тремя read-only методами (GetActiveOrderSummariesAsync, GetActiveOrderCountsByCategoryAsync, GetOverdueOrdersAsync) и добавлена проекция ActiveOrderSummary.
- /Users/anonymous/.cache/review/pr280/runs2/E1-X2/OrderReportService.cs (новый) — сервис OrderReportService с тремя методами для страницы отчётов, тонкая обёртка над OrderRepository.

Решения:
- Все запросы отчёта используют AsNoTracking (только чтение) и не трогают трекинг, использованный в существующих GetAllAsync/GetAsync.
- Правило Order.IsOverdue инлайнено вручную в Where (нетранслируемый вызов метода экземпляра в SQL), с комментарием, что при изменении IsOverdue нужно синхронизировать и запрос.
- Параметр now перед сравнением с CreatedAt приводится к DateTime.SpecifyKind(..., Unspecified), т.к. колонка CreatedAt замаплена как "timestamp without time zone" — иначе Npgsql бросит исключение при сравнении с Kind=Utc.
- "Активные" заказы фильтруются по Status == "active" (дефолтное значение поля); категории берутся из Order.Category, число позиций — через Items.Count (транслируется в подзапрос).
