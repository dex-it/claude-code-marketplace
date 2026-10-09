using Billing.Api.Application.Partners;

namespace Billing.Api.Modules;

public static class PartnersModule
{
    public static IServiceCollection AddPartners(this IServiceCollection services)
    {
        services.AddSingleton<PartnerImportValidator>();
        services.AddScoped<ImportPartnerInvoicesHandler>();
        return services;
    }
}
