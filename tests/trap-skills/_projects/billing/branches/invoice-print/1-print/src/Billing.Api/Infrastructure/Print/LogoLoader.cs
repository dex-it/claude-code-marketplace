namespace Billing.Api.Infrastructure.Print;

public static class LogoLoader
{
    public static async Task<string> LoadBase64Async(string url, CancellationToken ct)
    {
        try
        {
            using var http = new HttpClient();
            return Convert.ToBase64String(await http.GetByteArrayAsync(url, ct));
        }
        catch
        {
            return "";
        }
    }
}
