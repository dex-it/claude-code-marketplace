using Billing.Api.Application.Handlers.Invoices;

namespace Billing.Api.Infrastructure.Reminders;

public sealed class InvoiceReminderWorker(
    SendDueRemindersHandler handler,
    TimeProvider clock,
    ILogger<InvoiceReminderWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(24), clock);
        do
        {
            var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
            var result = await handler.HandleAsync(new SendDueRemindersCommand(today), stoppingToken);
            logger.LogInformation("Due reminders sent: {Count}", result.Value);
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
