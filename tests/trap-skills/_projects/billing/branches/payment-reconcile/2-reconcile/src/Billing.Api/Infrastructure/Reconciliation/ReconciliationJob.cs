using Billing.Api.Domain;
using Billing.Api.Infrastructure.Crm;
using Billing.Api.Infrastructure.Ledger;
using Billing.Api.Infrastructure.Persistence;
using Microsoft.Extensions.Options;

namespace Billing.Api.Infrastructure.Reconciliation;

public sealed class ReconciliationJob(
    IServiceScopeFactory scopes,
    InMemoryStore store,
    ReconciliationReports reports,
    TimeProvider clock,
    ILogger<ReconciliationJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(24), clock);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            var day = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime).AddDays(-1);
            try
            {
                await RunAsync(day, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Reconciliation for {Day} failed", day);
            }
        }
    }

    private async Task RunAsync(DateOnly day, CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var ledger = scope.ServiceProvider.GetRequiredService<LedgerReportClient>();
        var crm = scope.ServiceProvider.GetRequiredService<CrmClient>();
        var reminders = scope.ServiceProvider.GetRequiredService<ReminderSender>();
        var account = scope.ServiceProvider.GetRequiredService<IOptions<LedgerOptions>>().Value.Account;

        logger.LogInformation("Запрашиваем проводки из Ledger за {Day}", day);
        var entries = await ledger.GetEntriesAsync(account, day, ct);
        logger.LogInformation("Получили {Count} проводок", entries.Count);

        var byExternalId = new Dictionary<string, LedgerReportEntry>();
        foreach (var entry in entries)
        {
            logger.LogInformation("Reconciling ledger entry {ExternalId}", entry.ExternalId);
            byExternalId[entry.ExternalId] = entry;
        }

        var paid = store.Invoices.Values.Where(i => i.PaidAt is { } at && DateOnly.FromDateTime(at.UtcDateTime) == day);
        var lines = new List<string>();
        var matched = 0;
        foreach (var invoice in paid)
        {
            if (!byExternalId.TryGetValue($"pay-{invoice.Id}", out var entry))
                lines.Add($"{invoice.Id}: оплачен без проводки");
            else if (entry.AmountMinor != invoice.Amount.Minor)
                lines.Add($"{invoice.Id}: сумма проводки {entry.AmountMinor}, счёт {invoice.Amount.Minor}");
            else
                matched++;
        }

        reports.ByDay[day] = lines;
        logger.LogInformation("Отправляем отчёт в CRM");
        try
        {
            await crm.ReportMismatchAsync(new MismatchReport(day, lines), ct);
        }
        catch (Exception)
        {
        }

        var remindOn = day.AddDays(4);
        foreach (var invoice in store.Invoices.Values.Where(i => i.Status == InvoiceStatus.Issued && i.DueDate == remindOn))
        {
            try
            {
                await reminders.SendAsync(invoice, ct);
            }
            catch (HttpRequestException)
            {
                logger.LogError("Reminder for invoice {InvoiceId} failed", invoice.Id);
            }
        }

        logger.LogInformation("Reconciliation {Day} completed: {Matched} matched, {Mismatched} mismatched", day, matched, lines.Count);
    }
}
