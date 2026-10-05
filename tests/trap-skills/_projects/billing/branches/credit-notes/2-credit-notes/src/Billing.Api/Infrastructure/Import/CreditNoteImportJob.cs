using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Handlers.CreditNotes;
using Billing.Api.Domain;
using Microsoft.Extensions.Options;

namespace Billing.Api.Infrastructure.Import;

public sealed class CreditNoteImportOptions
{
    public string Folder { get; set; } = "";
}

public sealed class CreditNoteImportJob(
    IServiceScopeFactory scopes,
    IOptions<CreditNoteImportOptions> options,
    TimeProvider clock,
    ILogger<CreditNoteImportJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(24), clock);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            foreach (var file in Directory.EnumerateFiles(options.Value.Folder, "*.csv"))
            {
                await using var scope = scopes.CreateAsyncScope();
                await ImportFileAsync(scope.ServiceProvider, file, stoppingToken);
                File.Move(file, file + ".done");
            }
        }
    }

    private async Task ImportFileAsync(IServiceProvider services, string file, CancellationToken ct)
    {
        var invoices = services.GetRequiredService<IInvoiceRepository>();
        var drafts = services.GetRequiredService<CreateCreditNoteDraftHandler>();
        var issue = services.GetRequiredService<IssueCreditNoteHandler>();

        // invoiceId;reason;description;amountMinor
        foreach (var line in await File.ReadAllLinesAsync(file, ct))
        {
            var cols = line.Split(';');
            var invoiceId = new InvoiceId(Guid.Parse(cols[0]));
            var invoice = await invoices.FindAsync(invoiceId, ct);
            if (invoice is null)
            {
                logger.LogWarning("Import {File}: invoice {InvoiceId} not found", file, invoiceId);
                continue;
            }

            var draft = await drafts.HandleAsync(new CreateCreditNoteDraftCommand(
                invoiceId,
                Enum.Parse<CreditNoteReason>(cols[1]),
                [new CreditNoteLineInput(cols[2], long.Parse(cols[3]))]), ct);
            if (!draft.IsSuccess)
            {
                logger.LogWarning("Import {File}: {Code} for invoice {InvoiceId}", file, draft.Error!.Code, invoiceId);
                continue;
            }

            var issued = await issue.HandleAsync(new IssueCreditNoteCommand(draft.Value, invoice), ct);
            if (!issued.IsSuccess)
                logger.LogWarning("Import {File}: {Code} for invoice {InvoiceId}", file, issued.Error!.Code, invoiceId);
        }
    }
}
