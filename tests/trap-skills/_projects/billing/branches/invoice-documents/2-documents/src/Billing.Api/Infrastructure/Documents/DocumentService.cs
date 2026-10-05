using System.Collections.Concurrent;
using System.Text;
using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Documents;
using Billing.Api.Domain;
using Microsoft.Extensions.Options;

namespace Billing.Api.Infrastructure.Documents;

public sealed class DocumentOptions
{
    public string GotenbergUrl { get; set; } = "";
    public string ExportFolder { get; set; } = "";
    public int ArchiveRetentionDays { get; set; } = 1825;
}

public sealed class InMemoryDocumentArchive
{
    public ConcurrentDictionary<InvoiceId, ArchivedDocument> Documents { get; } = new();
}

public sealed class DocumentService(
    IInvoiceRepository invoices,
    InMemoryDocumentArchive archive,
    IPdfConverter pdf,
    IOptions<DocumentOptions> options,
    TimeProvider clock,
    ILogger<DocumentService> logger) : IDocumentService
{
    public async Task<Result<DocumentFile>> RenderAsync(InvoiceId invoiceId, string country, DocumentFormat format, CancellationToken ct)
    {
        var invoice = await invoices.FindAsync(invoiceId, ct);
        if (invoice is null)
            return new InvoiceNotFoundError(invoiceId);
        if (invoice.Status == InvoiceStatus.Cancelled)
            return new InvoiceInvalidStateError(invoice.Id, invoice.Status, "render document");

        if (DocumentPolicies.For(country).Validate(invoice) is { } invalid)
            return invalid;

        var locale = DocumentLocales.For(country);
        var renderer = InvoiceRenderers.For(country);
        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var lateFee = CalculateLateFeeMinor(invoice, today);

        byte[] content;
        string contentType;
        if (format == DocumentFormat.Html)
        {
            var html = renderer.RenderHtml(invoice, locale, lateFee);
            content = Encoding.UTF8.GetBytes(html);
            contentType = "text/html; charset=utf-8";
        }
        else
        {
            content = await renderer.RenderPdfAsync(invoice, locale, lateFee, pdf, ct);
            contentType = "application/pdf";
        }

        var templateCode = ((IDocumentTemplate)renderer).TemplateCode;
        var document = new ArchivedDocument(Guid.NewGuid(), invoice.Id, format, templateCode, clock.GetUtcNow(), content);
        archive.Documents[invoice.Id] = document;
        logger.LogInformation("Document {Format} for invoice {InvoiceId} rendered with template {Template}", format, invoice.Id, templateCode);

        return new DocumentFile(content, contentType, FileNameFor(invoice, format));
    }

    public Task<IReadOnlyList<ArchivedDocument>> ListArchivedAsync(InvoiceId invoiceId, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<ArchivedDocument>>(archive.Documents.Values.Where(d => d.InvoiceId == invoiceId).ToList());

    public Task<ArchivedDocument?> GetArchivedAsync(Guid documentId, CancellationToken ct) =>
        Task.FromResult(archive.Documents.Values.FirstOrDefault(d => d.Id == documentId));

    public Task DeleteArchivedAsync(Guid documentId, CancellationToken ct)
    {
        foreach (var (key, document) in archive.Documents)
            if (document.Id == documentId)
                archive.Documents.TryRemove(key, out _);
        return Task.CompletedTask;
    }

    public Task<int> PurgeArchiveAsync(DateTimeOffset olderThan, CancellationToken ct)
    {
        var purged = 0;
        foreach (var (key, document) in archive.Documents)
            if (document.CreatedAt < olderThan && archive.Documents.TryRemove(key, out _))
                purged++;
        return Task.FromResult(purged);
    }

    public Task<DocumentStatistics> GetStatisticsAsync(DateOnly day, CancellationToken ct)
    {
        var ofDay = archive.Documents.Values.Where(d => DateOnly.FromDateTime(d.CreatedAt.UtcDateTime) == day).ToList();
        return Task.FromResult(new DocumentStatistics(day, ofDay.Count(d => d.Format == DocumentFormat.Html), ofDay.Count(d => d.Format == DocumentFormat.Pdf)));
    }

    public async Task ExportDayAsync(DateOnly day, IReadOnlyList<(InvoiceId Id, string Country)> invoicesOfDay, CancellationToken ct)
    {
        var folder = Path.Combine(options.Value.ExportFolder, day.ToString("yyyy-MM-dd"));
        Directory.CreateDirectory(folder);
        foreach (var (id, country) in invoicesOfDay)
        {
            var invoice = await invoices.FindAsync(id, ct) ?? throw new InvalidOperationException($"Invoice {id} not found");
            if (DocumentPolicies.For(country).Validate(invoice) is { } error)
                throw new InvalidOperationException($"Invoice {id}: {error.Message}");

            var rendered = await RenderAsync(id, country, DocumentFormat.Pdf, ct);
            await File.WriteAllBytesAsync(Path.Combine(folder, rendered.Value!.FileName), rendered.Value.Content, ct);
        }
    }

    public long CalculateLateFeeMinor(Invoice invoice, DateOnly today)
    {
        if (invoice.Status != InvoiceStatus.Issued || invoice.DueDate >= today)
            return 0;
        var daysLate = today.DayNumber - invoice.DueDate.DayNumber;
        return invoice.Amount.Minor * daysLate / 1000;
    }

    public string FileNameFor(Invoice invoice, DocumentFormat format) =>
        $"invoice-{invoice.Id}.{(format == DocumentFormat.Html ? "html" : "pdf")}";
}

public sealed class GotenbergPdfConverter(HttpClient http) : IPdfConverter
{
    public async Task<byte[]> ConvertAsync(string html, CancellationToken ct)
    {
        using var form = new MultipartFormDataContent();
        form.Add(new StringContent(html, Encoding.UTF8, "text/html"), "files", "index.html");
        using var response = await http.PostAsync("forms/chromium/convert/html", form, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsByteArrayAsync(ct);
    }
}

public sealed class DocumentArchiveCleanupJob(IServiceScopeFactory scopes, IOptions<DocumentOptions> options, TimeProvider clock) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(24), clock);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await using var scope = scopes.CreateAsyncScope();
            var documents = scope.ServiceProvider.GetRequiredService<IDocumentService>();
            await documents.PurgeArchiveAsync(clock.GetUtcNow().AddDays(-options.Value.ArchiveRetentionDays), stoppingToken);
        }
    }
}
