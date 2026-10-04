using Billing.Api.Application.Handlers.Invoices;
using Billing.Api.Application.Installments;
using Billing.Api.Infrastructure.Mail;

namespace Billing.Api.Modules;

public static class InstallmentsModule
{
    public static IServiceCollection AddInstallmentsModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<AuditMailOptions>(configuration.GetSection("AuditMail"));
        services.AddSingleton<AuditMailer>();
        services.AddSingleton<InstallmentAuditSampler>();
        services.AddSingleton<InstallmentScheduleBuilder>();
        services.AddScoped<ScheduleInstallmentsValidator>();
        services.AddScoped<ScheduleInstallmentsHandler>();
        return services;
    }
}
