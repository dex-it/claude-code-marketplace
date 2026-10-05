using Billing.Api.Application.Abstractions;
using Billing.Api.Application.CreditNotes;
using Billing.Api.Application.Handlers.CreditNotes;
using Billing.Api.Infrastructure.Documents;
using Billing.Api.Infrastructure.Events;
using Billing.Api.Infrastructure.Import;
using Billing.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Billing.Api.Modules;

public static class CreditNotesModule
{
    public static IServiceCollection AddCreditNotesModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<BillingDbContext>(o => o.UseSqlite(configuration.GetConnectionString("Billing")));
        services.AddScoped<ICreditNoteRepository, EfCreditNoteRepository>();
        services.AddScoped<IDomainEventPublisher, InProcessDomainEventPublisher>();
        services.AddScoped<IDomainEventHandler<CreditNoteIssued>, CreditNoteDocumentSubscriber>();

        services.AddScoped<CreateCreditNoteDraftValidator>();
        services.AddScoped<CreateCreditNoteDraftHandler>();
        services.AddScoped<PreviewCreditNoteHandler>();
        services.AddScoped<ReplaceCreditNoteLinesHandler>();
        services.AddScoped<IssueCreditNoteHandler>();
        services.AddScoped<CustomerCreditNotesHandler>();
        services.AddScoped<CreditNotesDashboardHandler>();

        services.AddOptions<CreditNoteImportOptions>().BindConfiguration("CreditNoteImport");
        services.AddHostedService<CreditNoteImportJob>();
        return services;
    }
}
