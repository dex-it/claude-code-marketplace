using Billing.Api.Application.Handlers.Invoices;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Persistence;

namespace Billing.Tests;

public class RefundInvoiceHandlerTests
{
    [Fact]
    public async Task Refund_over_invoice_amount_is_rejected()
    {
        var (handler, invoice) = await PaidInvoice(amountMinor: 10_000);

        var result = await handler.HandleAsync(new RefundInvoiceCommand(invoice.Id, 10_001), default);

        Assert.Equal("refund.exceeds_amount", result.Error?.Code);
    }

    [Fact]
    public async Task Partial_refund_is_accepted()
    {
        var (handler, invoice) = await PaidInvoice(amountMinor: 10_000);

        var result = await handler.HandleAsync(new RefundInvoiceCommand(invoice.Id, 4_000), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(4_000, invoice.RefundedMinor);
    }

    [Fact]
    public async Task Second_refund_over_remaining_amount_is_rejected()
    {
        var (handler, invoice) = await PaidInvoice(amountMinor: 10_000);
        await handler.HandleAsync(new RefundInvoiceCommand(invoice.Id, 4_000), default);

        var result = await handler.HandleAsync(new RefundInvoiceCommand(invoice.Id, 7_000), default);

        Assert.Equal("refund.exceeds_amount", result.Error?.Code);
        Assert.Equal(4_000, invoice.RefundedMinor);
    }

    private static async Task<(RefundInvoiceHandler, Invoice)> PaidInvoice(long amountMinor)
    {
        var store = new InMemoryStore();
        var invoices = new InMemoryInvoiceRepository(store);
        var invoice = new Invoice
        {
            Id = InvoiceId.New(),
            CustomerId = new CustomerId(Guid.NewGuid()),
            Amount = new Money(amountMinor, "RUB"),
            DueDate = new DateOnly(2026, 10, 1),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        invoice.Issue();
        invoice.MarkPaid(DateTimeOffset.UtcNow);
        await invoices.AddAsync(invoice, default);
        var handler = new RefundInvoiceHandler(invoices, new InMemoryOutbox(store), new RefundInvoiceValidator(), TimeProvider.System);
        return (handler, invoice);
    }
}
