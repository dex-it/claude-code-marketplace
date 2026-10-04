using Acme.Ledger.Client;
using Billing.Api.Application.Abstractions;
using Billing.Api.Infrastructure.Ledger;
using Billing.Api.Infrastructure.Persistence;
using Microsoft.Extensions.Options;

namespace Billing.Api.Modules;

public static class LedgerModule
{
    public static IServiceCollection AddLedger(this IServiceCollection services)
    {
        services.AddOptions<LedgerOptions>().BindConfiguration("Ledger").ValidateDataAnnotations().ValidateOnStart();
        services.AddHttpClient<LedgerClient>((sp, http) =>
            http.BaseAddress = new Uri(sp.GetRequiredService<IOptions<LedgerOptions>>().Value.BaseUrl));
        services.AddScoped<ILedgerGateway, AcmeLedgerGateway>();
        services.AddScoped<IOutbox, InMemoryOutbox>();
        services.AddHostedService<LedgerOutboxDispatcher>();
        return services;
    }
}
