using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Pricing.Application.Abstractions;
using Pricing.Infrastructure.Persistence;
using Pricing.Infrastructure.Suppliers;
using Pricing.Infrastructure.Time;

namespace Pricing.Infrastructure;

public static class InfrastructureModule
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        services.AddSingleton<TimeProvider>(new StoreTimeProvider(
            TimeProvider.System, TimeZoneInfo.FindSystemTimeZoneById(config["Store:TimeZone"] ?? "Europe/Moscow")));
        services.AddSingleton<InMemoryStore>();
        services.AddScoped<IProductRepository, InMemoryProductRepository>();
        services.AddScoped<IPromotionRepository, InMemoryPromotionRepository>();

        services.Configure<SupplierOptions>(config.GetSection(SupplierOptions.Section));
        services.AddHttpClient<ISupplierCatalog, SupplierApiClient>((sp, http) =>
            {
                var o = sp.GetRequiredService<IOptions<SupplierOptions>>().Value;
                http.BaseAddress = o.BaseUrl;
                http.DefaultRequestHeaders.Add("X-Api-Key", o.ApiKey);
            })
            .AddStandardResilienceHandler(o =>
            {
                // Витрина ждёт 3 с (README); запас на собственную работу котировки.
                o.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(2.5);
                o.AttemptTimeout.Timeout = TimeSpan.FromSeconds(1);
            });
        return services;
    }
}
