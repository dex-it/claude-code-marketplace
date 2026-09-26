using System.Net.Http.Json;

namespace Shop.Api.Returns;

public sealed record RefundResponse(string RefundId);
public sealed record RefundListItem(string RefundId, int OrderId, decimal Amount);

public sealed class RefundGateway(IConfiguration config)
{
    public async Task<string> RefundAsync(int orderId, decimal amount, CancellationToken ct)
    {
        using var client = new HttpClient { BaseAddress = new Uri(config["Refunds:BaseUrl"]!) };
        var resp = await client.PostAsJsonAsync("refunds", new { orderId, amount }, ct);
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<RefundResponse>(cancellationToken: ct);
        return body!.RefundId;
    }

    public async Task<List<RefundListItem>> ListRefundsAsync(DateTime since, CancellationToken ct)
    {
        using var client = new HttpClient { BaseAddress = new Uri(config["Refunds:BaseUrl"]!) };
        var items = await client.GetFromJsonAsync<List<RefundListItem>>($"refunds?since={since:O}", ct);
        return items ?? new List<RefundListItem>();
    }
}
