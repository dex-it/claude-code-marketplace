using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Payments;
using Billing.Api.Domain;

namespace Billing.Api.Api;

public static class PaymentEndpoints
{
    public static IEndpointRouteBuilder MapPaymentEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/webhooks/paygate", async (PayGateNotification body, PaymentWebhookHandler handler, CancellationToken ct) =>
        {
            await handler.HandleAsync(body, ct);
            return Results.Ok();
        });

        app.MapPost("/invoices/{id:guid}/pay-from-balance", async (Guid id, PayFromBalanceHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new PayFromBalanceCommand(new InvoiceId(id)), ct))
            .ToHttp(_ => Results.NoContent()));

        app.MapGet("/invoices/{id:guid}/receipt", async (Guid id, IReceiptRepository receipts, CancellationToken ct) =>
            await receipts.FindAsync(new InvoiceId(id), ct) is { } receipt
                ? Results.Ok(new { status = receipt.Status, attempts = receipt.Attempts })
                : Results.NotFound());

        return app;
    }
}
