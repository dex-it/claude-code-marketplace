using Microsoft.EntityFrameworkCore;
using Shop.Data;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Shop")
    ?? throw new InvalidOperationException("Connection string 'Shop' not found.");

builder.Services.AddDbContext<ShopDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddHostedService<OverdueNotifier>();

var app = builder.Build();

app.Run();
