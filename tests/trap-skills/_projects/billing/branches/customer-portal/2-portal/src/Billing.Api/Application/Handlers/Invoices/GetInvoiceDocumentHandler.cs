using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record GetInvoiceDocumentQuery(CustomerId CustomerId, InvoiceId InvoiceId, string Name);

public sealed class GetInvoiceDocumentHandler(IInvoiceRepository invoices, IInvoiceDocumentRepository documents)
{
    public async Task<Result<InvoiceDocument>> HandleAsync(GetInvoiceDocumentQuery query, CancellationToken ct)
    {
        var invoice = await invoices.FindAsync(query.InvoiceId, ct);
        if (invoice is null || invoice.CustomerId != query.CustomerId)
            return new InvoiceNotFoundError(query.InvoiceId);

        var document = await documents.FindAsync(invoice.Id, query.Name, ct);
        return document is null ? new DocumentNotFoundError(query.Name) : document;
    }
}
