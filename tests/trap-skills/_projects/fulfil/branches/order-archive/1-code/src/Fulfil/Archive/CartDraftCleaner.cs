using MongoDB.Driver;

namespace Fulfil.Archive;

public sealed class CartDraftCleaner(IMongoDatabase db, ILogger<CartDraftCleaner> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        do
        {
            var cutoff = DateTimeOffset.UtcNow.AddDays(-30);
            var result = await db.GetCollection<CartDraft>("cart_drafts").DeleteManyAsync(d => d.UpdatedAt < cutoff, ct);
            log.LogInformation("Removed {Count} stale cart drafts", result.DeletedCount);
        }
        while (await timer.WaitForNextTickAsync(ct));
    }
}
