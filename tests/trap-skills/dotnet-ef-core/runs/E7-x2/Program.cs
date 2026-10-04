using Microsoft.EntityFrameworkCore;
using Shop.Data;

var builder = WebApplication.CreateBuilder(args);

// ShopDbContext в DI: Scoped (по умолчанию для AddDbContext) - именно поэтому
// OverdueNotifier ниже не инжектирует его напрямую, а создаёт свой scope на каждый тик.
builder.Services.AddDbContext<ShopDbContext>(options => options
    .UseNpgsql(builder.Configuration.GetConnectionString("Shop"))
    .UseLazyLoadingProxies()); // Order.Customer объявлена virtual - под это в проекте уже подключен пакет Proxies

builder.Services.AddScoped<OrderRepository>();
builder.Services.AddHostedService<OverdueNotifier>();

var app = builder.Build();

app.MapGet("/", () => "Shop API");

app.Run();
