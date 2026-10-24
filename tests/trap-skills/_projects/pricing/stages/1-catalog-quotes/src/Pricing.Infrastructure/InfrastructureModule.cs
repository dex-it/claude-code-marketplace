using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Pricing.Application.Abstractions;
using Pricing.Infrastructure.Persistence;
using Pricing.Infrastructure.Suppliers;

namespace Pricing.Infrastructure;

public static class InfrastructureModule
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
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
            .AddStandardResilienceHandler();
        return services;
    }
}
