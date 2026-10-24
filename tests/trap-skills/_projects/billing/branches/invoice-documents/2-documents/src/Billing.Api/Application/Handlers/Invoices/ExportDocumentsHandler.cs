using Billing.Api.Application.Documents;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record ExportDocumentsCommand(DateOnly Day, IReadOnlyList<(InvoiceId Id, string Country)> Invoices);

public sealed class ExportDocumentsHandler(IDocumentService documents)
{
    public async Task<Result<int>> HandleAsync(ExportDocumentsCommand command, CancellationToken ct)
    {
        await documents.ExportDayAsync(command.Day, command.Invoices, ct);
        return command.Invoices.Count;
    }
}
