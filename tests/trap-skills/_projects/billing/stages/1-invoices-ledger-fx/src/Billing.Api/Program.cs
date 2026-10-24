using Billing.Api.Api;
using Billing.Api.Infrastructure.Persistence;
using Billing.Api.Modules;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<InMemoryStore>();
builder.Services.AddLedger();
builder.Services.AddFx();
builder.Services.AddInvoicesModule();

var app = builder.Build();
app.MapInvoiceEndpoints();
app.Run();
