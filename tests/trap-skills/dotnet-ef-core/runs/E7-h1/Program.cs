using Microsoft.EntityFrameworkCore;
using Shop.Data;
using Shop.Workers;

var builder = WebApplication.CreateBuilder(args);

// Явный UseNpgsql без UseLazyLoadingProxies - навигации грузим Include, лениво не нужно.
builder.Services.AddDbContext<ShopDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("ShopDb")));

builder.Services.AddHostedService<OverdueNotifier>();

var app = builder.Build();

app.MapGet("/", () => "Shop API");

app.Run();
