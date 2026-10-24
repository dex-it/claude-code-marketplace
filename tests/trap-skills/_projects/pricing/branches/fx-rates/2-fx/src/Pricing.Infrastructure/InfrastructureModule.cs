using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.Extensions.Options;
using Polly;
using Pricing.Application.Abstractions;
using Pricing.Infrastructure.Persistence;
using Pricing.Infrastructure.Rates;
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
        services.AddHttpClient<ISupplierCatalog, SupplierApiClient>(ConfigureSupplier)
            .AddStandardResilienceHandler();
        services.AddHttpClient<ISupplierPriceBatch, SupplierPriceBatchClient>(ConfigureSupplier)
            .AddStandardResilienceHandler();

        services.Configure<PriceSyncOptions>(config.GetSection(PriceSyncOptions.Section));
        services.AddHostedService<PriceSyncJob>();

        // Казначейский Rates API стабилен, стандартный хендлер для него избыточен - свои повторы.
        services.Configure<RatesOptions>(config.GetSection(RatesOptions.Section));
        services.AddHttpClient<IRates, RatesApiClient>((sp, http) =>
                http.BaseAddress = sp.GetRequiredService<IOptions<RatesOptions>>().Value.BaseUrl)
            .AddResilienceHandler("rates", pipeline =>
            {
                pipeline.AddRetry(new HttpRetryStrategyOptions
                {
                    MaxRetryAttempts = 5,
                    Delay = TimeSpan.FromSeconds(1),
                    BackoffType = DelayBackoffType.Constant,
                    UseJitter = false,
                    ShouldHandle = args => ValueTask.FromResult(
                        args.Outcome.Exception is not null || args.Outcome.Result?.IsSuccessStatusCode == false),
                });
                pipeline.AddTimeout(TimeSpan.FromSeconds(10));
            });
        return services;
    }

    private static void ConfigureSupplier(IServiceProvider sp, HttpClient http)
    {
        var o = sp.GetRequiredService<IOptions<SupplierOptions>>().Value;
        http.BaseAddress = o.BaseUrl;
        http.DefaultRequestHeaders.Add("X-Api-Key", o.ApiKey);
    }
}
