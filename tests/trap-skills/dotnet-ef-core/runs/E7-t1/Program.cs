using Microsoft.EntityFrameworkCore;
using Shop.Data;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("ShopDb")
    ?? throw new InvalidOperationException("Connection string 'ShopDb' not found.");

// AddDbContext регистрирует ShopDbContext как Scoped (дефолт EF Core).
builder.Services.AddDbContext<ShopDbContext>(options => options.UseNpgsql(connectionString));

builder.Services.AddScoped<OrderRepository>();

// Скоуп на ShopDbContext создаётся внутри самого OverdueNotifier - Scoped нельзя внедрить в singleton.
builder.Services.AddHostedService<OverdueNotifier>();

var app = builder.Build();

app.Run();
