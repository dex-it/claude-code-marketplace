using Billing.Api.Application.Handlers.Invoices;
using Billing.Api.Infrastructure.FinanceMail;

namespace Billing.Api.Modules;

public static class OverdueModule
{
    public static IServiceCollection AddOverdueDigest(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<OverdueInvoicesValidator>();
        services.AddScoped<OverdueInvoicesHandler>();
        services.AddHttpClient<FinanceMailClient>(http => http.BaseAddress = new Uri(configuration["FinanceMail:BaseUrl"]!))
            .AddStandardResilienceHandler();
        services.AddHostedService<OverdueDigestJob>();
        return services;
    }
}
