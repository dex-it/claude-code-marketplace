namespace Billing.Api.Application.Partners;

public enum PartnerInvoiceKind { Goods, Services }

public sealed class PartnerInvoiceDto
{
    public Guid CustomerId { get; set; }
    public string ExternalNumber { get; set; } = "";
    public string Description { get; set; } = "";
    public string? Comment { get; set; }
    public string Amount { get; set; } = "";
    public string Currency { get; set; } = "";
    public double FxRate { get; set; }
    public PartnerInvoiceKind Kind { get; set; }
    public DateOnly DueDate { get; set; }
}

public sealed class PartnerImportRequest
{
    public List<PartnerInvoiceDto> Invoices { get; set; } = [];
}

public static class PartnerLimits
{
    public const int MaxInvoices = 1000;
    public const int MaxBodyBytes = 5 * 1024 * 1024;
    public const int CommentMaxBytes = 2000;
    public const decimal MinAmount = 1m;
    public const decimal MaxAmount = 1_000_000m;
}
