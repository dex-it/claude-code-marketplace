using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Messages;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record RefundInvoiceCommand(InvoiceId InvoiceId, long AmountMinor);

public sealed class RefundInvoiceHandler(
    IInvoiceRepository invoices,
    IOutbox outbox,
    RefundInvoiceValidator validator,
    TimeProvider clock)
{
    public async Task<Result<InvoiceId>> HandleAsync(RefundInvoiceCommand command, CancellationToken ct)
    {
        if (validator.Check(command) is { } error)
            return error;

        var invoice = await invoices.FindAsync(command.InvoiceId, ct);
        if (invoice is null)
            return new InvoiceNotFoundError(command.InvoiceId);
        if (invoice.Status != InvoiceStatus.Paid)
            return new InvoiceInvalidStateError(invoice.Id, invoice.Status, "refund");

        var alreadyRefundedMinor = invoice.RefundedMinor;
        if (alreadyRefundedMinor + command.AmountMinor >= invoice.Amount.Minor)
            return new RefundExceedsAmountError(invoice.Id, invoice.Amount.Minor - alreadyRefundedMinor);

        var refund = new Refund(Guid.NewGuid(), invoice.Amount with { Minor = command.AmountMinor }, clock.GetUtcNow());
        var reversal = refund.Amount with { Minor = -refund.Amount.Minor };
        var externalId = $"refund-{invoice.Id}-{invoice.Refunds.Count + 1}";
        await outbox.EnqueueAsync(new LedgerPostingRequested(externalId, reversal, "Invoice refund"), ct);

        invoice.AddRefund(refund);
        await invoices.SaveAsync(invoice, ct);
        return invoice.Id;
    }
}
