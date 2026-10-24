using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Messages;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Persistence;
using Billing.Contracts;

namespace Billing.Api.Infrastructure.Notifications;

public sealed class ReceiptOutboxDispatcher(
    IServiceScopeFactory scopes,
    InMemoryStore store,
    TimeProvider clock,
    ILogger<ReceiptOutboxDispatcher> logger) : BackgroundService
{
    private const int MaxAttempts = 5;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(10), clock);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await using var scope = scopes.CreateAsyncScope();
            var receipts = scope.ServiceProvider.GetRequiredService<IReceiptRepository>();
            var customers = scope.ServiceProvider.GetRequiredService<ICustomerDirectory>();
            var notifications = scope.ServiceProvider.GetRequiredService<INotificationsClient>();
            var outbox = scope.ServiceProvider.GetRequiredService<IOutbox>();

            foreach (var message in store.Outbox.Where(m => m.SentAt is null && m.Payload is ReceiptRequested or RetryReceiptCommand))
            {
                var invoiceId = message.Payload switch
                {
                    ReceiptRequested r => r.InvoiceId,
                    RetryReceiptCommand r => r.InvoiceId,
                    _ => throw new InvalidOperationException(),
                };
                message.SentAt = clock.GetUtcNow();

                var receipt = await receipts.FindAsync(new InvoiceId(invoiceId), stoppingToken);
                if (receipt is null || receipt.Status == ReceiptStatus.Sent)
                    continue;

                try
                {
                    receipt.StartSending();
                    var email = await customers.FindEmailAsync(receipt.CustomerId, stoppingToken)
                        ?? throw new InvalidOperationException($"No email for customer {receipt.CustomerId}");
                    await notifications.SendReceiptAsync(email, receipt, stoppingToken);
                    receipt.Complete();
                }
                catch (Exception ex)
                {
                    receipt.Fail();
                    logger.LogWarning(ex, "Receipt for invoice {InvoiceId} failed, attempt {Attempt}", invoiceId, receipt.Attempts);
                    if (receipt.Attempts < MaxAttempts)
                        await outbox.EnqueueAsync(new RetryReceiptCommand(invoiceId, receipt.Attempts), stoppingToken);
                }

                await receipts.SaveAsync(receipt, stoppingToken);
            }
        }
    }
}
