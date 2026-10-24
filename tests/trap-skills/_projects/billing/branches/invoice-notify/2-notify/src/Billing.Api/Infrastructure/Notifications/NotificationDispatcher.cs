using Billing.Api.Application.Notifications;
using Billing.Api.Infrastructure.Persistence;

namespace Billing.Api.Infrastructure.Notifications;

public sealed class NotificationDispatcher(
    InMemoryStore store,
    PushSender push,
    EmailSender email,
    TimeProvider clock,
    ILogger<NotificationDispatcher> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(10), clock);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            var jobId = Guid.NewGuid();
            logger.LogDebug("Job {JobId}: pass started, {Queued} queued", jobId, store.Notifications.Count);
            var retry = new List<InvoiceIssuedNotification>();
            while (store.Notifications.TryDequeue(out var n))
            {
                if (!store.Customers.TryGetValue(n.CustomerId.Value, out var profile))
                {
                    logger.LogDebug("Job {JobId}: no profile for customer {CustomerId}", jobId, n.CustomerId);
                    continue;
                }

                logger.LogInformation("Job {JobId}: notifying {@Profile} about {InvoiceId} for {@Amount}", jobId, profile, n.InvoiceId, n.Amount);
                try
                {
                    foreach (var device in profile.Devices)
                    {
                        logger.LogDebug("Job {JobId}: push to {Platform}", jobId, device.Platform);
                        await push.SendAsync(device, "Новый счёт", $"Счёт на {n.Amount.Minor / 100m:0.00} {n.Amount.Currency}", stoppingToken);
                    }
                    await email.SendInvoiceIssuedAsync(profile, n, stoppingToken);
                    logger.LogInformation("Job {JobId}: invoice {InvoiceId} notification sent to customer {CustomerId}", jobId, n.InvoiceId, n.CustomerId);
                }
                catch (PushProviderUnavailableException ex)
                {
                    logger.LogWarning(ex, "Job {JobId}: push provider unavailable, invoice {InvoiceId} retried next pass", jobId, n.InvoiceId);
                    retry.Add(n);
                }
            }
            retry.ForEach(store.Notifications.Enqueue);
            logger.LogDebug("Job {JobId}: pass finished, {Retry} to retry", jobId, retry.Count);
        }
    }
}
