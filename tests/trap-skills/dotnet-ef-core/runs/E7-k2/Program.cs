using Microsoft.EntityFrameworkCore;
using Shop.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<ShopDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Shop")
        ?? throw new InvalidOperationException("Connection string 'Shop' is not configured.")));

builder.Services.AddHostedService<OverdueNotifier>();

var app = builder.Build();

app.MapGet("/", () => "Shop API");

app.Run();
