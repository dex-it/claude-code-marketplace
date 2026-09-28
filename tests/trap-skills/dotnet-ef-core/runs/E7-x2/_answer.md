Изменённые/созданные файлы:
- /Users/anonymous/.cache/review/pr280/runs2/E7-X2/Shop.Data.csproj (изменён: Sdk -> Microsoft.NET.Sdk.Web, чтобы получить WebApplication/Hosting без лишних пакетов)
- /Users/anonymous/.cache/review/pr280/runs2/E7-X2/Program.cs (новый: DI-регистрация ShopDbContext через AddDbContext + UseNpgsql/UseLazyLoadingProxies, регистрация OverdueNotifier как HostedService)
- /Users/anonymous/.cache/review/pr280/runs2/E7-X2/OverdueNotifier.cs (новый: BackgroundService на PeriodicTimer(1 минута))
- /Users/anonymous/.cache/review/pr280/runs2/E7-X2/appsettings.json (новый: строка подключения ConnectionStrings:Shop)

Решения:
- ShopDbContext зарегистрирован как Scoped (AddDbContext по умолчанию), поэтому в OverdueNotifier (Singleton hosted service) он не инжектируется напрямую - берётся IServiceScopeFactory и на каждую итерацию таймера создаётся свой scope/DbContext.
- Order.IsOverdue(DateTime) - обычный C#-метод, не транслируется в SQL, поэтому в Where условие продублировано инлайн (ShippedAt == null && CreatedAt < threshold); выборка - только чтение, поэтому AsNoTracking().
- CreatedAt смаплен на "timestamp without time zone" (пишется/сравнивается как Kind=Unspecified), поэтому порог сравнения приведён через DateTime.SpecifyKind(..., Unspecified); AuditLog.At - колонка без явного типа (timestamptz, Kind=Utc), пишем DateTime.UtcNow как есть. Автомиграций на старте (Database.Migrate()) намеренно не добавлял - миграции на production применяются отдельным шагом, не из hosted-кода приложения.
