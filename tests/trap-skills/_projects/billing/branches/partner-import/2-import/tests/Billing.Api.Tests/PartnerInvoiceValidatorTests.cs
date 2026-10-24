using Billing.Api.Application.Partners;
using Xunit;

namespace Billing.Api.Tests;

public sealed class PartnerInvoiceValidatorTests
{
    private readonly PartnerInvoiceValidator _validator = new();

    private static PartnerInvoiceDto Valid() => new()
    {
        CustomerId = Guid.NewGuid(),
        ExternalNumber = "INV-2026-001",
        Description = "Поставка за ноябрь",
        Amount = "1234,50",
        Currency = "RUB",
        FxRate = 1,
        Kind = PartnerInvoiceKind.Goods,
        DueDate = new DateOnly(2026, 12, 15),
    };

    [Fact]
    public void Valid_invoice_passes() => Assert.True(_validator.Validate(Valid()).IsValid);

    [Fact]
    public void Description_over_limit_fails()
    {
        var dto = Valid();
        dto.Description = new string('x', 300);
        Assert.False(_validator.Validate(dto).IsValid);
    }

    [Fact]
    public void Amount_out_of_range_fails()
    {
        var dto = Valid();
        dto.Amount = "0,50";
        var error = Assert.Single(_validator.Validate(dto).Errors);
        Assert.Equal("amount.range", error.ErrorCode);
    }
}
