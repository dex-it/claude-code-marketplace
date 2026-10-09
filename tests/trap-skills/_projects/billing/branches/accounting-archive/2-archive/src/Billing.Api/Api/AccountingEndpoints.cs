using System.Buffers;
using System.Globalization;
using Billing.Api.Infrastructure.Accounting;
using Microsoft.Extensions.Options;

namespace Billing.Api.Api;

public static class AccountingEndpoints
{
    private const string CorrectionsHeader = "invoiceId;amountMinor;currency";

    public static IEndpointRouteBuilder MapAccountingEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/accounting/archives/{period}", async (string period, HttpContext http, IOptions<AccountingOptions> options) =>
        {
            if (!DateOnly.TryParseExact(period, "yyyy-MM", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
                return Results.Problem("Period must be yyyy-MM", statusCode: 400, extensions: new Dictionary<string, object?> { ["code"] = "validation" });
            var path = Path.Combine(options.Value.ArchiveDirectory, $"invoices-{period}.zip");
            if (!File.Exists(path))
                return Results.Problem($"No archive for {period}", statusCode: 404, extensions: new Dictionary<string, object?> { ["code"] = "archive.not_found" });

            http.Response.ContentType = "application/zip";
            await using var file = File.OpenRead(path);
            var buffer = new byte[1024 * 1024];
            int read;
            while ((read = await file.ReadAsync(buffer, http.RequestAborted)) > 0)
                await http.Response.Body.WriteAsync(buffer.AsMemory(0, read), http.RequestAborted);
            return Results.Empty;
        });

        app.MapPost("/accounting/corrections", async (IFormFile file, IOptions<AccountingOptions> options, TimeProvider clock, CancellationToken ct) =>
        {
            var stream = file.OpenReadStream();
            using (var reader = new StreamReader(stream))
            {
                if (await reader.ReadLineAsync(ct) != CorrectionsHeader)
                    return Results.Problem("Unexpected header", statusCode: 400, extensions: new Dictionary<string, object?> { ["code"] = "validation" });
            }
            stream.Position = 0;

            var temp = new TempArchiveFile(Path.Combine(options.Value.ArchiveDirectory, $"{Guid.NewGuid():N}.tmp"));
            await using (var target = File.Create(temp.Path))
            {
                var buffer = ArrayPool<byte>.Shared.Rent(81920);
                try
                {
                    int read;
                    while ((read = await stream.ReadAsync(buffer, ct)) > 0)
                        await target.WriteAsync(buffer.AsMemory(0, read), ct);
                }
                finally
                {
                    ArrayPool<byte>.Shared.Return(buffer);
                }
            }

            var name = $"corrections-{clock.GetUtcNow():yyyyMMddHHmmss}.csv";
            File.Move(temp.Path, Path.Combine(options.Value.ArchiveDirectory, name));
            return Results.Ok(new { name });
        }).DisableAntiforgery();

        return app;
    }
}
