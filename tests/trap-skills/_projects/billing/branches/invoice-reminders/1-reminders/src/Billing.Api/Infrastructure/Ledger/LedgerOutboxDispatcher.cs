using Acme.Ledger.Client;
using Billing.Api.Application.Messages;
using Billing.Api.Infrastructure.Persistence;
using Microsoft.Extensions.Options;

namespace Billing.Api.Infrastructure.Ledger;

public sealed class LedgerOutboxDispatcher(
    IServiceScopeFactory scopes,
    InMemoryStore store,
    TimeProvider clock,
    ILogger<LedgerOutboxDispatcher> logger) : BackgroundService
{
    private const int TimeoutRetries = 3;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5), clock);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await using var scope = scopes.CreateAsyncScope();
            var client = scope.ServiceProvider.GetRequiredService<LedgerClient>();
            var account = scope.ServiceProvider.GetRequiredService<IOptions<LedgerOptions>>().Value.Account;

            foreach (var message in store.Outbox.Where(m => m.SentAt is null && m.Payload is LedgerPostingRequested))
            {
                var posting = (LedgerPostingRequested)message.Payload;
                var entry = new LedgerEntry
                {
                    ExternalId = posting.ExternalId,
                    Account = account,
                    AmountMinor = posting.Amount.Minor,
                    Currency = posting.Amount.Currency,
                    Description = posting.Description,
                };
                try
                {
                    if (await PostWithRetryAsync(client, entry, stoppingToken))
                        message.SentAt = clock.GetUtcNow();
                }
                catch (LedgerUnavailableException ex)
                {
                    // Клиент бросает её на 503 и 429 - откладываем до следующего тика.
                    logger.LogWarning(ex, "Ledger unavailable, posting {ExternalId} postponed", posting.ExternalId);
                    break;
                }
            }
        }
    }

    // Таймаут HttpClient повторяем сразу: Acme.Ledger.Client 2.3.1 ставит Idempotency-Key = entry.ExternalId,
    // поэтому повторная отправка той же проводки второй записи в Ledger не создаёт.
    private static async Task<bool> PostWithRetryAsync(LedgerClient client, LedgerEntry entry, CancellationToken ct)
    {
        for (var attempt = 0; attempt <= TimeoutRetries; attempt++)
        {
            try
            {
                await client.PostEntryAsync(entry, ct);
                return true;
            }
            catch (TaskCanceledException) when (!ct.IsCancellationRequested && attempt < TimeoutRetries)
            {
                _ = Task.Delay(TimeSpan.FromMilliseconds(300 * (attempt + 1)), ct);
            }
            catch (TaskCanceledException) when (!ct.IsCancellationRequested)
            {
                return false;
            }
        }

        return false;
    }
}
