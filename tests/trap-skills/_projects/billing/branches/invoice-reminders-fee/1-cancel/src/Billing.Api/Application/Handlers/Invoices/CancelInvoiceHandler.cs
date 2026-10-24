using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Messages;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record CancelInvoiceCommand(InvoiceId InvoiceId);

public sealed class CancelInvoiceHandler(IInvoiceRepository invoices, IOutbox outbox)
{
    public async Task<Result<InvoiceId>> HandleAsync(CancelInvoiceCommand command, CancellationToken ct)
    {
        var invoice = await invoices.FindAsync(command.InvoiceId, ct);
        if (invoice is null)
            return new InvoiceNotFoundError(command.InvoiceId);

        if (invoice.Status == InvoiceStatus.Paid)
        {
            var reversal = invoice.Amount with { Minor = -invoice.Amount.Minor };
            await outbox.EnqueueAsync(new LedgerPostingRequested($"cancel-{invoice.Id}", reversal, "Invoice cancelled"), ct);
        }

        invoice.Cancel();
        await invoices.SaveAsync(invoice, ct);
        return invoice.Id;
    }
}
