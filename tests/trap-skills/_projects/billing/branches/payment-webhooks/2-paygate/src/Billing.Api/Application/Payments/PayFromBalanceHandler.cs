using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Messages;
using Billing.Api.Domain;

namespace Billing.Api.Application.Payments;

public sealed record PayFromBalanceCommand(InvoiceId InvoiceId);

public sealed record InsufficientBalanceError(CustomerId CustomerId)
    : BillingError("balance.insufficient", $"Customer {CustomerId} has insufficient balance");

public sealed class PayFromBalanceHandler(
    IInvoiceRepository invoices,
    ICustomerBalance balance,
    IOutbox outbox,
    IAnalyticsClient analytics,
    TimeProvider clock)
{
    public async Task<Result<InvoiceId>> HandleAsync(PayFromBalanceCommand command, CancellationToken ct)
    {
        var invoice = await invoices.FindAsync(command.InvoiceId, ct);
        if (invoice is null)
            return new InvoiceNotFoundError(command.InvoiceId);
        if (invoice.Status != InvoiceStatus.Issued)
            return new InvoiceInvalidStateError(invoice.Id, invoice.Status, "pay");

        if (!await balance.TryDebitAsync(invoice.CustomerId, invoice.Amount, ct))
            return new InsufficientBalanceError(invoice.CustomerId);

        invoice.MarkPaid(clock.GetUtcNow());
        await outbox.EnqueueAsync(new LedgerPostingRequested($"pay-{invoice.Id}", invoice.Amount, "Invoice payment from balance"), ct);
        await analytics.PushInvoicePaidAsync(invoice, ct);
        await invoices.SaveAsync(invoice, ct);
        return invoice.Id;
    }
}
