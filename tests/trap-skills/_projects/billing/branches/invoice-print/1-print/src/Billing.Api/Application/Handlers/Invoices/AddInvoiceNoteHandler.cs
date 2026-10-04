using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record AddInvoiceNoteCommand(InvoiceId InvoiceId, string Note, string OperatorId);

public sealed class AddInvoiceNoteHandler(IInvoiceRepository invoices)
{
    public async Task<Result<InvoiceId>> HandleAsync(AddInvoiceNoteCommand command, CancellationToken ct)
    {
        var invoice = await invoices.FindAsync(command.InvoiceId, ct);
        if (invoice is null)
            return new InvoiceNotFoundError(command.InvoiceId);

        invoice.SetNote(command.Note, command.OperatorId);
        await invoices.SaveAsync(invoice, ct);
        return invoice.Id;
    }
}
