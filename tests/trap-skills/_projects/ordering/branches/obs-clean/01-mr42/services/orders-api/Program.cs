using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;
using OrdersApi.Health;
using OrdersApi.Orders;
using Serilog;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog((ctx, cfg) => cfg.ReadFrom.Configuration(ctx.Configuration).Enrich.WithSpan().WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {TraceId} {Message:lj}{NewLine}{Exception}"));
builder.Services.AddSingleton<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<OrderService>();
builder.Services.AddOpenTelemetry()
    .WithTracing(t => t
        .AddAspNetCoreInstrumentation(o => o.Filter = ctx => !ctx.Request.Path.StartsWithSegments("/health"))
        .AddSource(OrderService.SourceName).AddOtlpExporter())
    .WithMetrics(m => m.AddAspNetCoreInstrumentation().AddMeter(OrderService.SourceName).AddPrometheusExporter());
builder.Services.AddHealthChecks().AddCheck<DbHealthCheck>("db", tags: new[] { "ready" }, timeout: TimeSpan.FromSeconds(2));

var app = builder.Build();
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = c => c.Tags.Contains("ready") });
app.MapPrometheusScrapingEndpoint();
app.MapPost("/orders", async (CreateOrderRequest r, OrderService s, CancellationToken ct) =>
    Results.Created("/orders", await s.CreateAsync(r, ct)));
app.MapGet("/orders/{id:guid}", async (Guid id, IOrderRepository repo, CancellationToken ct) =>
    await repo.FindAsync(id, ct) is { } o ? Results.Ok(o) : Results.NotFound());
app.Run();
