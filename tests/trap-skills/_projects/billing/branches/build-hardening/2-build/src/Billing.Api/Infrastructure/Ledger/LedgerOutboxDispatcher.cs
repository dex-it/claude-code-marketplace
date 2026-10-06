using Acme.Ledger.Client;
using Billing.Api.Application.Messages;
using Billing.Api.Infrastructure.Persistence;
using Microsoft.Extensions.Options;

#pragma warning disable CA2000

namespace Billing.Api.Infrastructure.Ledger;

public sealed class LedgerOutboxDispatcher(
    IServiceScopeFactory scopes,
    InMemoryStore store,
    TimeProvider clock,
    ILogger<LedgerOutboxDispatcher> logger) : BackgroundService
{
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
                try
                {
                    await client.PostEntryAsync(new LedgerEntry
                    {
                        ExternalId = posting.ExternalId,
                        Account = account,
                        AmountMinor = posting.Amount.Minor,
                        Currency = posting.Amount.Currency,
                        Description = posting.Description,
                    }, stoppingToken);
                    message.SentAt = clock.GetUtcNow();
                }
                catch (LedgerUnavailableException ex)
                {
                    logger.LogWarning(ex, "Ledger unavailable, posting {ExternalId} postponed", posting.ExternalId);
                    break;
                }
            }
        }
    }
}
