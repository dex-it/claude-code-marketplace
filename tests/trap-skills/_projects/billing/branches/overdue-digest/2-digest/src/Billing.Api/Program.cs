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
builder.Services.AddOverdueDigest(builder.Configuration);

var app = builder.Build();
app.MapInvoiceEndpoints();
app.MapOverdueEndpoints();
app.Run();
