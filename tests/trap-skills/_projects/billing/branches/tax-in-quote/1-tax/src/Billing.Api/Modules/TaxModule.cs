using Billing.Api.Infrastructure.Tax;
using Microsoft.Extensions.Options;

namespace Billing.Api.Modules;

public static class TaxModule
{
    public static IServiceCollection AddTax(this IServiceCollection services)
    {
        services.AddOptions<TaxOptions>().BindConfiguration("Tax").ValidateDataAnnotations().ValidateOnStart();
        // Стандартный конвейер по ADR-0007. Дефолты: 3 повтора с экспоненциальной задержкой,
        // таймаут попытки 10 с, общий таймаут запроса 30 с - для GET справочника подходят.
        services.AddHttpClient<TaxRatesClient>((sp, http) =>
                http.BaseAddress = new Uri(sp.GetRequiredService<IOptions<TaxOptions>>().Value.BaseUrl))
            .AddStandardResilienceHandler();
        return services;
    }
}
