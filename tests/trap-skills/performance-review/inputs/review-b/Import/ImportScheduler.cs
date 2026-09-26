namespace Catalog.Worker.Import;

public sealed class ImportScheduler(IServiceScopeFactory scopes, IConfiguration config) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            var now = DateTime.Now;
            var next = now.Date.AddHours(2);
            if (next <= now) next = next.AddDays(1);
            await Task.Delay(next - now, ct);

            using var scope = scopes.CreateScope();
            var job = scope.ServiceProvider.GetRequiredService<CatalogImportJob>();
            await job.RunAsync(config["Import:Path"]!, ct);
        }
    }
}
