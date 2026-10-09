using System.Net.Http.Json;

namespace Billing.Api.Infrastructure.Bank;

public enum BankPaymentStatus { Pending, Settled, Returned }

public sealed class BankClient(HttpClient http)
{
    public async Task<BankPaymentStatus> GetPaymentStatusAsync(string paymentRef, CancellationToken ct)
    {
        var response = await http.GetFromJsonAsync<StatusResponse>($"v2/payments/{Uri.EscapeDataString(paymentRef)}/status", ct);
        return response!.Status;
    }

    private sealed record StatusResponse(BankPaymentStatus Status);
}
