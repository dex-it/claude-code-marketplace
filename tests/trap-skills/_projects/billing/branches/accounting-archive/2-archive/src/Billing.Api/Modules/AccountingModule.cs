using Billing.Api.Infrastructure.Accounting;
using Microsoft.Extensions.Options;

namespace Billing.Api.Modules;

public static class AccountingModule
{
    public static IServiceCollection AddAccounting(this IServiceCollection services)
    {
        services.AddOptions<AccountingOptions>().BindConfiguration("Accounting").ValidateDataAnnotations().ValidateOnStart();
        services.AddHttpClient<AccountingStorageClient>((sp, http) =>
            http.BaseAddress = new Uri(sp.GetRequiredService<IOptions<AccountingOptions>>().Value.BaseUrl));
        services.AddScoped<AccountingArchiveBuilder>();
        services.AddScoped<AccountingNotifier>();
        services.AddHostedService<AccountingArchiveJob>();
        return services;
    }
}
