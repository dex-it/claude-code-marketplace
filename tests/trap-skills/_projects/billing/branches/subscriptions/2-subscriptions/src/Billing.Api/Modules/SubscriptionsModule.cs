using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Handlers.Subscriptions;
using Billing.Api.Application.Subscriptions;
using Billing.Api.Infrastructure.Persistence;
using Billing.Api.Infrastructure.Subscriptions;

namespace Billing.Api.Modules;

public static class SubscriptionsModule
{
    public static IServiceCollection AddSubscriptionsModule(this IServiceCollection services)
    {
        services.AddScoped<InMemorySubscriptionRepository>();
        services.AddScoped<ISubscriptionRepository>(sp => sp.GetRequiredService<InMemorySubscriptionRepository>());
        services.AddScoped<ISubscriptionItemRepository>(sp => sp.GetRequiredService<InMemorySubscriptionRepository>());
        services.AddScoped<IRenewalRunRepository>(sp => sp.GetRequiredService<InMemorySubscriptionRepository>());
        services.AddSingleton<ISubscriptionClock, SystemSubscriptionClock>();
        services.AddSingleton<ProrationService>();

        services.AddScoped<CreateSubscriptionValidator>();
        services.AddScoped<CreateSubscriptionHandler>();
        services.AddScoped<GetSubscriptionHandler>();
        services.AddScoped<AddSubscriptionItemHandler>();
        services.AddScoped<ChangeItemPriceValidator>();
        services.AddScoped<ChangeItemPriceHandler>();
        services.AddScoped<RecordUsageHandler>();
        services.AddScoped<SuspendSubscriptionHandler>();
        services.AddScoped<ResumeSubscriptionHandler>();
        services.AddScoped<GetDueSubscriptionsHandler>();
        services.AddScoped<StaleSubscriptionsHandler>();

        services.AddHostedService<RenewalJob>();
        return services;
    }
}
