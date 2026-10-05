using Billing.Api.Api;
using Billing.Api.Infrastructure.Persistence;
using Billing.Api.Modules;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<InMemoryStore>();
builder.Services.AddLedger();
builder.Services.AddFx();
builder.Services.AddApi();
builder.Services.AddInvoicesModule();
builder.Services.AddCreditNotesModule(builder.Configuration);

var app = builder.Build();

// Стенд на SQLite: схема создаётся при старте, миграции - с переходом на Postgres (BILL-34).
await using (var scope = app.Services.CreateAsyncScope())
    await scope.ServiceProvider.GetRequiredService<BillingDbContext>().Database.EnsureCreatedAsync();

app.MapInvoiceEndpoints();
app.MapCreditNoteEndpoints();
app.Run();
