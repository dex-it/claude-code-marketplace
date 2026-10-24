using Microsoft.EntityFrameworkCore;
using Shop.Data;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Shop")
    ?? throw new InvalidOperationException("Connection string 'Shop' is not configured.");

builder.Services.AddDbContext<ShopDbContext>(options => options.UseNpgsql(connectionString));

builder.Services.AddScoped<OrderRepository>();
builder.Services.AddHostedService<OverdueNotifier>();

var app = builder.Build();

app.MapGet("/orders", async (OrderRepository repo) => await repo.GetAllAsync());
app.MapGet("/orders/{id:guid}", async (Guid id, OrderRepository repo) =>
    await repo.GetAsync(id) is { } order ? Results.Ok(order) : Results.NotFound());

app.Run();
