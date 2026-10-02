Изменённые/созданные файлы:
- /Users/anonymous/.cache/review/pr280/runs2/E7-X1/Program.cs (новый) - регистрация ShopDbContext (AddDbContext + UseNpgsql, строка подключения ConnectionStrings:ShopDb) и AddHostedService<OverdueNotifier>.
- /Users/anonymous/.cache/review/pr280/runs2/E7-X1/OverdueNotifier.cs (новый) - BackgroundService на PeriodicTimer(1 минута).
- /Users/anonymous/.cache/review/pr280/runs2/E7-X1/Shop.Data.csproj (изменён) - добавлен <FrameworkReference Include="Microsoft.AspNetCore.App" />, чтобы WebApplication/DI были доступны без перехода на Sdk.Web.

Решения:
- Условие Order.IsOverdue(now) - обычный C#-метод и нетранслируем в SQL, поэтому в запросе оно инлайнено как o.ShippedAt == null && o.CreatedAt < cutoff; выборка read-only -> AsNoTracking(), HasQueryFilter(!IsDeleted) применяется автоматически.
- Order.CreatedAt замаплен на "timestamp without time zone" -> параметр cutoff сделан с Kind=Unspecified (DateTime.SpecifyKind), иначе Npgsql бросит исключение; AuditLog.At маппится по умолчанию (timestamptz) -> пишется DateTime.UtcNow с Kind=Utc.
- DbContext - scoped, BackgroundService - singleton: на каждый тик таймера воркер создаёт свой IServiceScope через IServiceScopeFactory, чтобы не держать один и тот же ShopDbContext между итерациями; ошибки итерации логируются и не останавливают цикл.
