using System.Buffers;
using System.Security.Cryptography;

namespace Billing.Api.Infrastructure.Accounting;

public sealed class AccountingStorageClient(HttpClient http)
{
    public async Task UploadAsync(string period, string path, CancellationToken ct)
    {
        await using var file = File.OpenRead(path);
        var checksum = await ChecksumAsync(file, ct);
        file.Position = 0;

        using var content = new StreamContent(file);
        content.Headers.Add("X-Checksum-Sha256", checksum);
        using var response = await http.PostAsync($"v1/archives/{period}", content, ct);
        response.EnsureSuccessStatusCode();
    }

    private static async Task<string> ChecksumAsync(Stream stream, CancellationToken ct)
    {
        using var sha = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        var buffer = ArrayPool<byte>.Shared.Rent(81920);
        int read;
        while ((read = await stream.ReadAsync(buffer, ct)) > 0)
            sha.AppendData(buffer, 0, read);
        ArrayPool<byte>.Shared.Return(buffer);
        return Convert.ToHexString(sha.GetHashAndReset());
    }
}
