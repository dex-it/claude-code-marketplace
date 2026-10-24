using Microsoft.EntityFrameworkCore;
using Shop.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<ShopDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Shop")));

builder.Services.AddScoped<OrderRepository>();
builder.Services.AddHostedService<OverdueNotifier>();

var app = builder.Build();

app.Run();
