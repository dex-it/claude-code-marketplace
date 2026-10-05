using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Handlers.Invoices;
using Billing.Api.Infrastructure.Persistence;

namespace Billing.Api.Modules;

public static class InvoicesModule
{
    public static IServiceCollection AddInvoicesModule(this IServiceCollection services)
    {
        services.AddScoped<IInvoiceRepository, InMemoryInvoiceRepository>();
        services.AddScoped<CreateInvoiceValidator>();
        services.AddScoped<CreateInvoiceHandler>();
        services.AddScoped<PayInvoiceHandler>();
        services.AddScoped<CancelInvoiceHandler>();
        services.AddScoped<QuoteInvoiceHandler>();
        services.AddScoped<ApplyDiscountValidator>();
        services.AddScoped<ApplyDiscountHandler>();
        return services;
    }
}
