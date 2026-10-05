using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record CancelInvoiceCommand(InvoiceId InvoiceId);

public sealed class CancelInvoiceHandler(IInvoiceRepository invoices, ILedgerGateway ledger)
{
    public async Task<Result<InvoiceId>> HandleAsync(CancelInvoiceCommand command, CancellationToken ct)
    {
        var invoice = await invoices.FindAsync(command.InvoiceId, ct);
        if (invoice is null)
            return new InvoiceNotFoundError(command.InvoiceId);
        if (invoice.Status is not (InvoiceStatus.Issued or InvoiceStatus.Paid))
            return new InvoiceInvalidStateError(invoice.Id, invoice.Status, "cancel");

        if (invoice.Status == InvoiceStatus.Paid)
        {
            // Бэк-офис видит сторно в Ledger сразу после отмены, без ожидания тика outbox.
            var reversal = invoice.Amount with { Minor = -invoice.Amount.Minor };
            await ledger.PostAsync(new LedgerPosting($"cancel-{invoice.Id}", reversal, "Invoice cancelled"), ct);
        }

        invoice.Cancel();
        await invoices.SaveAsync(invoice, ct);
        return invoice.Id;
    }
}
