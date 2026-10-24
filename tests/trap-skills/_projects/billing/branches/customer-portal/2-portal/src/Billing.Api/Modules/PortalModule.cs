using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Handlers.Customers;
using Billing.Api.Application.Handlers.Invoices;
using Billing.Api.Infrastructure.Persistence;
using Billing.Api.Infrastructure.Portal;

namespace Billing.Api.Modules;

public static class PortalModule
{
    public static IServiceCollection AddPortal(this IServiceCollection services)
    {
        services.AddOptions<PortalOptions>().BindConfiguration("Portal");
        services.AddSingleton<PortalTokens>();
        services.AddScoped<ICustomerRepository, InMemoryCustomerRepository>();
        services.AddScoped<IInvoiceDocumentRepository, InMemoryInvoiceDocumentRepository>();
        services.AddScoped<CreateCustomerValidator>();
        services.AddScoped<CreateCustomerHandler>();
        services.AddScoped<LoginCustomerHandler>();
        services.AddScoped<GetCustomerProfileHandler>();
        services.AddScoped<UpdateCustomerProfileHandler>();
        services.AddScoped<ListCustomerInvoicesHandler>();
        services.AddScoped<GetCustomerInvoiceHandler>();
        services.AddScoped<AddInvoiceDocumentHandler>();
        services.AddScoped<GetInvoiceDocumentHandler>();
        services.AddHostedService<DemoCustomerSeeder>();
        return services;
    }
}
