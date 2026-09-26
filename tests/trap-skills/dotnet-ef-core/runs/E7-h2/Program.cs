using Microsoft.EntityFrameworkCore;
using Shop.Data;

var builder = WebApplication.CreateBuilder(args);

// Factory, не AddDbContext: даёт синглтону OverdueNotifier контекст без ручного IServiceScopeFactory.
builder.Services.AddDbContextFactory<ShopDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("ShopDb")));

builder.Services.AddHostedService<OverdueNotifier>();

var app = builder.Build();

app.MapGet("/", () => "Shop API");

app.Run();
