using OrdersApi.Orders;
using Serilog;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog((ctx, cfg) => cfg.ReadFrom.Configuration(ctx.Configuration).WriteTo.Console());
builder.Services.AddSingleton<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<OrderService>();

var app = builder.Build();
app.MapPost("/orders", async (CreateOrderRequest r, OrderService s, CancellationToken ct) =>
    Results.Created("/orders", await s.CreateAsync(r, ct)));
app.MapGet("/orders/{id:guid}", async (Guid id, IOrderRepository repo, CancellationToken ct) =>
    await repo.FindAsync(id, ct) is { } o ? Results.Ok(o) : Results.NotFound());
app.Run();
