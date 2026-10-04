namespace Billing.Api.Application;

public sealed class BillingOptions
{
    // Значение из конфигурации перекрывает этот дефолт.
    public long MaxInvoiceAmountMinor { get; set; } = 100_000_000;

    // Дефолт для локального запуска. Список из конфигурации заменяет его целиком:
    // в проде RUB выключен - appsettings.Production.json перечисляет только USD и EUR.
    public List<string> AllowedCurrencies { get; set; } = ["RUB"];
}
