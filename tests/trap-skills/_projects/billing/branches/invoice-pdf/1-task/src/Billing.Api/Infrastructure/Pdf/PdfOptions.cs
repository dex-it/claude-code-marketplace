using System.ComponentModel.DataAnnotations;

namespace Billing.Api.Infrastructure.Pdf;

public sealed class PdfOptions
{
    [Required]
    public string ToolPath { get; set; } = "/usr/local/bin/htmlpdf";

    [Range(1, 300)]
    public int TimeoutSeconds { get; set; } = 30;
}
