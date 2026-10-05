using Billing.Api.Application.Documents;
using Billing.Api.Application.Handlers.Invoices;
using Billing.Api.Infrastructure.Documents;
using Microsoft.Extensions.Options;

namespace Billing.Api.Modules;

public static class DocumentsModule
{
    public static IServiceCollection AddDocumentsModule(this IServiceCollection services)
    {
        services.AddOptions<DocumentOptions>().BindConfiguration("Documents");
        services.AddSingleton<InMemoryDocumentArchive>();
        services.AddHttpClient<IPdfConverter, GotenbergPdfConverter>((sp, http) =>
                http.BaseAddress = new Uri(sp.GetRequiredService<IOptions<DocumentOptions>>().Value.GotenbergUrl))
            .AddStandardResilienceHandler();
        services.AddScoped<IDocumentService, DocumentService>();
        services.AddScoped<GetInvoiceDocumentHandler>();
        services.AddScoped<ExportDocumentsHandler>();
        services.AddHostedService<DocumentArchiveCleanupJob>();
        return services;
    }
}
