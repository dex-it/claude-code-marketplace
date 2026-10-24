using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Shop.Data;

var builder = WebApplication.CreateBuilder(args);

// ShopDbContext: EF Core 8 + Npgsql.EntityFrameworkCore.PostgreSQL 8.
// Строка подключения ожидается в конфигурации: ConnectionStrings:ShopDb.
var connectionString = builder.Configuration.GetConnectionString("ShopDb")
    ?? throw new InvalidOperationException("Connection string 'ShopDb' is not configured.");

builder.Services.AddDbContext<ShopDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddScoped<OrderRepository>();

// Фоновый воркер: раз в минуту находит просроченные заказы и пишет AuditLog.
builder.Services.AddHostedService<OverdueNotifier>();

var app = builder.Build();

app.Run();
