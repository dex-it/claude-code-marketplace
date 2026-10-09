using Billing.Api.Infrastructure.Crm;
using Billing.Api.Infrastructure.Ledger;
using Billing.Api.Infrastructure.Reconciliation;
using Microsoft.Extensions.Options;

namespace Billing.Api.Modules;

public static class ReconciliationModule
{
    public static IServiceCollection AddReconciliation(this IServiceCollection services)
    {
        services.AddHttpClient<LedgerReportClient>((sp, http) =>
                http.BaseAddress = new Uri(sp.GetRequiredService<IOptions<LedgerOptions>>().Value.BaseUrl))
            .AddStandardResilienceHandler();
        services.AddHttpClient<CrmClient>(http => http.BaseAddress = new Uri("https://crm.internal/"))
            .AddStandardResilienceHandler();
        services.AddScoped<ReminderSender>();
        services.AddSingleton<ReconciliationReports>();
        services.AddHostedService<ReconciliationJob>();
        return services;
    }
}
