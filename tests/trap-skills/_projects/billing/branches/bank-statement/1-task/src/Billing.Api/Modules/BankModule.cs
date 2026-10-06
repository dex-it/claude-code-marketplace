using Billing.Api.Application.Abstractions;
using Billing.Api.Infrastructure.Bank;
using Billing.Api.Infrastructure.Statements;
using Microsoft.Extensions.Options;

namespace Billing.Api.Modules;

public static class BankModule
{
    public static IServiceCollection AddBank(this IServiceCollection services)
    {
        services.AddOptions<BankOptions>().BindConfiguration("Bank").ValidateDataAnnotations().ValidateOnStart();
        services.AddHttpClient<BankClient>((sp, http) =>
                http.BaseAddress = new Uri(sp.GetRequiredService<IOptions<BankOptions>>().Value.BaseUrl))
            .AddStandardResilienceHandler();
        services.AddSingleton<IStatementArchive, FileStatementArchive>();
        return services;
    }
}
