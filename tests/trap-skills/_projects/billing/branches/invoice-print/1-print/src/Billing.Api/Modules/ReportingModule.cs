using Billing.Api.Application.Handlers.Invoices;
using Billing.Api.Infrastructure.Print;
using Billing.Api.Infrastructure.Reporting;
using Microsoft.EntityFrameworkCore;

namespace Billing.Api.Modules;

public static class ReportingModule
{
    public static IServiceCollection AddReporting(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<ReportingDbContext>(o => o.UseSqlite(configuration["Reporting:ConnectionString"]));
        services.AddOptions<PrintOptions>().BindConfiguration("Print");
        services.AddSingleton<PdfRenderer>();
        services.AddScoped<SearchInvoicesHandler>();
        services.AddScoped<PrintInvoiceHandler>();
        services.AddScoped<AddInvoiceNoteHandler>();
        return services;
    }
}
