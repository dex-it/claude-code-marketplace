using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record PayInvoiceCommand(InvoiceId InvoiceId);

public sealed class PayInvoiceHandler(IInvoiceRepository invoices, ILedgerGateway ledger, TimeProvider clock)
{
    public async Task<Result<InvoiceId>> HandleAsync(PayInvoiceCommand command, CancellationToken ct)
    {
        var invoice = await invoices.FindAsync(command.InvoiceId, ct);
        if (invoice is null)
            return new InvoiceNotFoundError(command.InvoiceId);
        if (invoice.Status != InvoiceStatus.Issued)
            return new InvoiceInvalidStateError(invoice.Id, invoice.Status, "pay");

        await ledger.PostAsync(new LedgerPosting($"pay-{invoice.Id}", invoice.Amount, "Invoice payment"), ct);
        invoice.MarkPaid(clock.GetUtcNow());
        await invoices.SaveAsync(invoice, ct);
        return invoice.Id;
    }
}
