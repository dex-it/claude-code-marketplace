using System.Diagnostics;

namespace Billing.Api.Infrastructure.Print;

public sealed class PdfRenderer
{
    public async Task<byte[]> RenderAsync(string html, string fileName, CancellationToken ct)
    {
        var exe = Environment.GetEnvironmentVariable("WKHTMLTOPDF_PATH") ?? "wkhtmltopdf";
        var htmlPath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}.html");
        var pdfPath = Path.Combine(Path.GetTempPath(), $"{fileName}.pdf");
        await File.WriteAllTextAsync(htmlPath, html, ct);

        var command = $"{exe} --quiet {htmlPath} {pdfPath}";
        Console.WriteLine($"PDF: {command}");
        using var process = Process.Start(new ProcessStartInfo("/bin/sh", $"-c \"{command}\"") { UseShellExecute = false })!;
        await process.WaitForExitAsync(ct);

        return await File.ReadAllBytesAsync(pdfPath, ct);
    }
}
