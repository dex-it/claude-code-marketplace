using Billing.Api.Api;
using Billing.Api.Infrastructure.Persistence;
using Billing.Api.Modules;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.Seq("http://seq.internal:5341")
    .CreateLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();

    builder.Services.AddSingleton(TimeProvider.System);
    builder.Services.AddSingleton<InMemoryStore>();
    builder.Services.AddLedger();
    builder.Services.AddFx();
    builder.Services.AddApi();
    builder.Services.AddInvoicesModule();
    builder.Services.AddNotifications();

    var app = builder.Build();
    app.MapInvoiceEndpoints();
    app.MapDeviceEndpoints();
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Billing host terminated unexpectedly");
    Environment.Exit(1);
}
