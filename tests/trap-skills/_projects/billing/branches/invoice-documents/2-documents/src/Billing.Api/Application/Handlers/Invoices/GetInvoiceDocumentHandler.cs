using Billing.Api.Application.Documents;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record GetInvoiceDocumentQuery(InvoiceId InvoiceId, string Country, DocumentFormat Format);

public sealed class GetInvoiceDocumentHandler(IDocumentService documents)
{
    public Task<Result<DocumentFile>> HandleAsync(GetInvoiceDocumentQuery query, CancellationToken ct) =>
        documents.RenderAsync(query.InvoiceId, query.Country.ToUpperInvariant(), query.Format, ct);
}
