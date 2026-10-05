using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Messages;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Fx;
using Billing.Contracts;

namespace Billing.Api.Application.Payments;

public sealed record PayGateNotification(
    string PspReference,
    string MerchantReference,
    long AmountMinor,
    string Currency,
    string EventCode,
    bool Success);

public sealed class PaymentWebhookHandler(
    IInvoiceRepository invoices,
    IReceiptRepository receipts,
    ICustomerBalance balance,
    IOutbox outbox,
    FxRatesClient fx,
    TimeProvider clock,
    ILogger<PaymentWebhookHandler> logger)
{
    public async Task HandleAsync(PayGateNotification notification, CancellationToken ct)
    {
        if (!notification.Success || notification.EventCode != "AUTHORISATION")
            return;
        if (!Guid.TryParse(notification.MerchantReference, out var id))
            return;

        var invoice = await invoices.FindAsync(new InvoiceId(id), ct);
        if (invoice is null)
        {
            logger.LogWarning("PayGate payment for unknown invoice {MerchantReference}", notification.MerchantReference);
            return;
        }

        var paid = notification.Currency == invoice.Amount.Currency
            ? notification.AmountMinor
            : (long)Math.Round(notification.AmountMinor * await fx.GetRateAsync(notification.Currency, invoice.Amount.Currency, ct), MidpointRounding.ToEven);

        if (invoice.Status != InvoiceStatus.Issued)
        {
            await balance.CreditAsync(invoice.CustomerId, new Money(paid, invoice.Amount.Currency), ct);
            return;
        }

        invoice.MarkPaidByPsp(clock.GetUtcNow(), notification.PspReference, notification.EventCode);
        await outbox.EnqueueAsync(new LedgerPostingRequested($"pay-{invoice.Id}", invoice.Amount, "Invoice payment"), ct);
        if (paid > invoice.Amount.Minor)
            await balance.CreditAsync(invoice.CustomerId, new Money(paid - invoice.Amount.Minor, invoice.Amount.Currency), ct);

        await receipts.SaveAsync(new Receipt
        {
            InvoiceId = invoice.Id,
            CustomerId = invoice.CustomerId,
            AmountMinor = invoice.Amount.Minor,
            Currency = invoice.Amount.Currency,
            Status = ReceiptStatus.Sent,
        }, ct);
        await outbox.EnqueueAsync(new ReceiptRequested(invoice.Id.Value), ct);
        await outbox.EnqueueAsync(new InvoicePaidV1(invoice.Id.Value, invoice.CustomerId.Value, invoice.Amount.Minor, invoice.Amount.Currency, invoice.PaidAt!.Value), ct);

        await invoices.SaveAsync(invoice, ct);
        logger.LogInformation("Invoice {InvoiceId} paid", invoice.Id);
    }
}
