using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record AddInvoiceDocumentCommand(InvoiceId InvoiceId, string Name, byte[] Content);

public sealed class AddInvoiceDocumentHandler(IInvoiceRepository invoices, IInvoiceDocumentRepository documents)
{
    public async Task<Result<string>> HandleAsync(AddInvoiceDocumentCommand command, CancellationToken ct)
    {
        if (await invoices.FindAsync(command.InvoiceId, ct) is null)
            return new InvoiceNotFoundError(command.InvoiceId);

        await documents.AddAsync(new InvoiceDocument(command.InvoiceId, command.Name, command.Content), ct);
        return command.Name;
    }
}
