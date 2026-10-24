using Billing.Api.Application.Abstractions;

namespace Billing.Api.Infrastructure.Statements;

public sealed class FileStatementArchive(IConfiguration configuration) : IStatementArchive
{
    public async Task SaveAsync(string fileName, Stream content, CancellationToken ct)
    {
        var dir = configuration["Statements:ArchiveDir"] ?? "/var/billing/statements";
        Directory.CreateDirectory(dir);
        await using var file = File.Create(Path.Combine(dir, fileName));
        await content.CopyToAsync(file, ct);
    }
}
