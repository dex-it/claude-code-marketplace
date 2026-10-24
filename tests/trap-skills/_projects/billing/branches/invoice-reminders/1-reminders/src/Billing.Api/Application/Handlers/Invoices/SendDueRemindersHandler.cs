using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Fx;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record SendDueRemindersCommand(DateOnly Today);

public sealed class SendDueRemindersHandler(
    IInvoiceRepository invoices,
    ILedgerGateway ledger,
    FxRatesClient fx,
    INotificationSender notifications)
{
    public async Task<Result<int>> HandleAsync(SendDueRemindersCommand command, CancellationToken ct)
    {
        var sent = 0;
        foreach (var invoice in await invoices.ListByStatusAsync(InvoiceStatus.Issued, ct))
        {
            if (invoice.DueDate >= command.Today)
                continue;

            var daysLate = command.Today.DayNumber - invoice.DueDate.DayNumber;
            var fee = invoice.Amount with { Minor = invoice.Amount.Minor * daysLate / 1000 };
            await ledger.PostAsync(new LedgerPosting($"fee-{invoice.Id}-{command.Today:yyyyMMdd}", fee, "Late fee"), ct);

            var rate = await fx.GetRateAsync(invoice.Amount.Currency, "RUB", ct);
            var dueRub = (long)Math.Round((invoice.Amount.Minor + fee.Minor) * rate, MidpointRounding.ToEven);
            await NotifyAsync(invoice.Id.Value, invoice.CustomerId.Value, dueRub, ct);
            sent++;
        }

        return sent;
    }

    private Task NotifyAsync(Guid customerId, Guid invoiceId, long dueRubMinor, CancellationToken ct) =>
        notifications.SendAsync(new NotificationRequest(
            customerId,
            $"Счёт {invoiceId} просрочен",
            $"К оплате {dueRubMinor / 100m:0.00} RUB"), ct);
}
