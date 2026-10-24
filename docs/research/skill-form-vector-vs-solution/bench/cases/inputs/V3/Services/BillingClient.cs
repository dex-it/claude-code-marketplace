namespace ConfReg.Services;

public sealed class BillingOptions
{
    public string BusUrl { get; set; } = "";
    public string ApiKey { get; set; } = "";
}

public sealed record InvoiceLine(string Description, int Quantity, long UnitPriceKopecks, long AmountKopecks);

public sealed record Invoice(
    string CustomerInn,
    string? CustomerKpp,
    string CustomerName,
    IReadOnlyList<InvoiceLine> Lines,
    long VatKopecks,
    long TotalKopecks);

public interface IBillingClient
{
    /// <summary>
    /// Выставляет счёт в 1С через интеграционную шину и возвращает его номер.
    /// Каждый вызов создаёт в 1С новый счёт; аннулировать счёт можно только вручную в 1С.
    /// </summary>
    Task<string> CreateInvoiceAsync(Invoice invoice, CancellationToken ct);
}

public class BillingBusClient : IBillingClient
{
    private readonly HttpClient _http;

    public BillingBusClient(HttpClient http)
    {
        _http = http;
    }

    public async Task<string> CreateInvoiceAsync(Invoice invoice, CancellationToken ct)
    {
        using var response = await _http.PostAsJsonAsync("invoices", invoice, ct);
        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<CreatedInvoice>(cancellationToken: ct);
        return created!.Number;
    }

    private sealed record CreatedInvoice(string Number);
}
