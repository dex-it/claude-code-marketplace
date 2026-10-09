using Billing.Api.Application.Abstractions;
using Billing.Api.Infrastructure.Audit;
using Billing.Api.Infrastructure.Identity;
using Microsoft.Extensions.Options;

namespace Billing.Api.Modules;

public static class AuditModule
{
    public static IServiceCollection AddAudit(this IServiceCollection services)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, HttpCurrentUser>();
        services.AddOptions<AuditOptions>().BindConfiguration("Audit").ValidateDataAnnotations().ValidateOnStart();
        services.AddHttpClient<AuditClient>((sp, http) =>
                http.BaseAddress = new Uri(sp.GetRequiredService<IOptions<AuditOptions>>().Value.BaseUrl))
            .AddStandardResilienceHandler();
        return services;
    }
}
