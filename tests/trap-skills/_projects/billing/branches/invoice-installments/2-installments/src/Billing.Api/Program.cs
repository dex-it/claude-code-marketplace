using Billing.Api.Api;
using Billing.Api.Infrastructure.Configuration;
using Billing.Api.Infrastructure.Persistence;
using Billing.Api.Modules;

var builder = WebApplication.CreateBuilder(args);
BillingConfig.Current = builder.Configuration;

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<InMemoryStore>();
builder.Services.AddLedger();
builder.Services.AddFx();
builder.Services.AddApi();
builder.Services.AddInvoicesModule();
builder.Services.AddInstallmentsModule(builder.Configuration);

var app = builder.Build();
app.MapInvoiceEndpoints();
app.Run();
