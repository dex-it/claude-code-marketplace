using System.Collections.Concurrent;
using System.Globalization;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Persistence;
using Microsoft.Extensions.Options;
using Microsoft.IO;

namespace Billing.Api.Infrastructure.Accounting;

public sealed class AccountingArchiveBuilder(InMemoryStore store, IOptions<AccountingOptions> options)
{
    private static readonly RecyclableMemoryStreamManager Streams = new();
    private static readonly ConcurrentDictionary<string, Func<Invoice, string>> Formatters = new();

    public async Task<string> BuildAsync(int year, int month, CancellationToken ct)
    {
        var format = Formatters.GetOrAdd("csv", _ => invoice => string.Join(options.Value.Delimiter,
            invoice.Id, invoice.CustomerId, invoice.Amount.Minor, invoice.Amount.Currency, invoice.Status,
            invoice.CreatedAt.ToString("O", CultureInfo.InvariantCulture)));

        var csv = Streams.GetStream("accounting-csv");
        await using (var writer = new StreamWriter(csv, Encoding.UTF8, leaveOpen: true))
        {
            await writer.WriteLineAsync("id;customerId;amountMinor;currency;status;createdAt");
            foreach (var invoice in store.Invoices.Values.Where(i => i.CreatedAt.Month == month))
                await writer.WriteLineAsync(format(invoice));
        }

        var hash = Convert.ToHexString(SHA256.HashData(csv.GetBuffer().AsSpan(0, (int)csv.Length)));
        csv.Position = 0;

        var path = Path.Combine(options.Value.ArchiveDirectory, $"invoices-{year}-{month:00}.zip");
        var file = new FileStream(path, FileMode.Create, FileAccess.Write);
        var zip = new ZipArchive(file, ZipArchiveMode.Create);
        await using (var entry = zip.CreateEntry("invoices.csv").Open())
            await csv.CopyToAsync(entry, ct);
        await using (var manifest = new StreamWriter(zip.CreateEntry("manifest.txt").Open()))
            await manifest.WriteAsync($"sha256 {hash}");

        ArchiveEvents.RaiseBuilt(path);
        return path;
    }
}
