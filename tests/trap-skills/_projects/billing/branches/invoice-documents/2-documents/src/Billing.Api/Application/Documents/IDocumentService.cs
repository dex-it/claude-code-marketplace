using Billing.Api.Domain;

namespace Billing.Api.Application.Documents;

public sealed record DocumentFile(byte[] Content, string ContentType, string FileName);

public sealed record ArchivedDocument(Guid Id, InvoiceId InvoiceId, DocumentFormat Format, string TemplateCode, DateTimeOffset CreatedAt, byte[] Content);

public sealed record DocumentStatistics(DateOnly Day, int Html, int Pdf);

public interface IDocumentService
{
    Task<Result<DocumentFile>> RenderAsync(InvoiceId invoiceId, string country, DocumentFormat format, CancellationToken ct);
    Task<IReadOnlyList<ArchivedDocument>> ListArchivedAsync(InvoiceId invoiceId, CancellationToken ct);
    Task<ArchivedDocument?> GetArchivedAsync(Guid documentId, CancellationToken ct);
    Task DeleteArchivedAsync(Guid documentId, CancellationToken ct);
    Task<int> PurgeArchiveAsync(DateTimeOffset olderThan, CancellationToken ct);
    Task<DocumentStatistics> GetStatisticsAsync(DateOnly day, CancellationToken ct);
    Task ExportDayAsync(DateOnly day, IReadOnlyList<(InvoiceId Id, string Country)> invoices, CancellationToken ct);
    long CalculateLateFeeMinor(Invoice invoice, DateOnly today);
    string FileNameFor(Invoice invoice, DocumentFormat format);
}
