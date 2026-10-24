using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Edo;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record SendInvoiceCommand(InvoiceId InvoiceId);

public sealed class SendInvoiceHandler(IInvoiceRepository invoices, HttpJsonPoster edo)
{
    public async Task<Result<string>> HandleAsync(SendInvoiceCommand command, CancellationToken ct)
    {
        var invoice = await invoices.FindAsync(command.InvoiceId, ct);
        if (invoice is null)
            return new InvoiceNotFoundError(command.InvoiceId);

        var payload = await edo.BuildPayloadAsync(invoice, ct);
        return await edo.PostAsync(payload, ct);
    }
}
