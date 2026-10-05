using Billing.Api.Api;
using Billing.Api.Infrastructure.Persistence;
using Billing.Api.Modules;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<InMemoryStore>();
builder.Services.AddLedger();
builder.Services.AddFx();
builder.Services.AddApi();
builder.Services.AddInvoicesModule();
builder.Services.AddPaymentsModule(builder.Configuration);

var app = builder.Build();
app.MapInvoiceEndpoints();
app.MapPaymentEndpoints();
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = c => c.Tags.Contains("live") });
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = c => c.Tags.Contains("ready") });
app.Run();
