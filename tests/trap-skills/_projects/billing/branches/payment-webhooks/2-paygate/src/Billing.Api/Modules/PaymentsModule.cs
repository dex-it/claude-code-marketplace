using Acme.Ledger.Client;
using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Payments;
using Billing.Api.Infrastructure.Analytics;
using Billing.Api.Infrastructure.Balance;
using Billing.Api.Infrastructure.Crm;
using Billing.Api.Infrastructure.Health;
using Billing.Api.Infrastructure.Notifications;
using Billing.Api.Infrastructure.Persistence;
using Microsoft.Extensions.Options;
using Npgsql;
using StackExchange.Redis;

namespace Billing.Api.Modules;

public static class PaymentsModule
{
    public static IServiceCollection AddPaymentsModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(configuration.GetConnectionString("Redis")!));
        services.AddSingleton<ICustomerBalance, RedisCustomerBalance>();
        services.AddHostedService<ExpiredBalanceJob>();

        services.AddSingleton(_ => NpgsqlDataSource.Create(configuration.GetConnectionString("Crm")!));
        services.AddScoped<ICustomerDirectory, CrmCustomerDirectory>();

        services.AddOptions<NotificationsOptions>().BindConfiguration("Notifications");
        services.AddHttpClient<INotificationsClient, NotificationsClient>((sp, http) =>
                http.BaseAddress = new Uri(sp.GetRequiredService<IOptions<NotificationsOptions>>().Value.BaseUrl))
            .AddStandardResilienceHandler();

        services.AddOptions<AnalyticsOptions>().BindConfiguration("Analytics");
        services.AddHttpClient<IAnalyticsClient, AnalyticsClient>((sp, http) =>
                http.BaseAddress = new Uri(sp.GetRequiredService<IOptions<AnalyticsOptions>>().Value.BaseUrl))
            .AddStandardResilienceHandler();

        services.AddScoped<IReceiptRepository, InMemoryReceiptRepository>();
        services.AddHostedService<ReceiptOutboxDispatcher>();

        services.AddScoped<PaymentWebhookHandler>();
        services.AddScoped<PayFromBalanceHandler>();

        services.AddHealthChecks()
            .AddCheck<LedgerHealthCheck>("ledger", tags: ["live", "ready"])
            .AddCheck<RedisHealthCheck>("redis", tags: ["live", "ready"]);
        services.AddHttpClient(nameof(LedgerClient), (sp, http) =>
            http.BaseAddress = new Uri(sp.GetRequiredService<IOptions<Infrastructure.Ledger.LedgerOptions>>().Value.BaseUrl));
        return services;
    }
}
