using System.Net;
using System.Net.Http.Json;
using Billing.Api.Application.Notifications;
using Serilog;

namespace Billing.Api.Infrastructure.Notifications;

public sealed class PushProviderUnavailableException(string message) : Exception(message);

public sealed class PushSender(HttpClient http)
{
    public async Task SendAsync(CustomerDevice device, string title, string body, CancellationToken ct)
    {
        Log.Information($"Sending push to {device.Platform} device of length {device.Token.Length}");
        using var response = await http.PostAsJsonAsync($"v1/{device.Platform}/send",
            new { token = device.Token, title, body }, ct);
        if (response.StatusCode == HttpStatusCode.ServiceUnavailable)
            throw new PushProviderUnavailableException($"Push provider {device.Platform} unavailable");
        response.EnsureSuccessStatusCode();
        Console.WriteLine($"push ok {device.Platform}");
    }
}
