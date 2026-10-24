namespace Billing.Api.Infrastructure.Reporting;

public sealed class ReportInvoiceRow
{
    public Guid Id { get; set; }
    public string CustomerName { get; set; } = "";
    public long AmountMinor { get; set; }
    public string Currency { get; set; } = "";
    public DateOnly IssuedAt { get; set; }
}
