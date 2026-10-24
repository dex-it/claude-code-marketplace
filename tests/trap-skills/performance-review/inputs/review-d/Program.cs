using Microsoft.EntityFrameworkCore;
using Shop.Api.Data;
using Shop.Api.Infrastructure;
using Shop.Api.Notifications;
using Shop.Api.Orders;
using Shop.Api.Returns;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<ShopDbContext>(o => o
    .UseNpgsql(builder.Configuration.GetConnectionString("Shop"))
    .UseLazyLoadingProxies());

builder.Services.Configure<ReturnsOptions>(builder.Configuration.GetSection("Returns"));
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddScoped<ITenantService, TenantService>();
builder.Services.AddScoped<TenantFilter>();
builder.Services.AddScoped<OrderLookup>();
builder.Services.AddScoped<ReturnPolicy>();
builder.Services.AddScoped<ReturnValidator>();
builder.Services.AddScoped<ReturnService>();
builder.Services.AddSingleton<ReturnMapper>();
builder.Services.AddSingleton<RefundGateway>();
builder.Services.AddHttpClient<ReturnNotifier>(c =>
    c.BaseAddress = new Uri(builder.Configuration["Notifications:BaseUrl"]!));
builder.Services.AddHostedService<ReturnsReconciliationJob>();

builder.Services.AddControllers(o => o.Filters.AddService<TenantFilter>());
builder.Services.AddShopProblemDetails();

var app = builder.Build();
app.UseExceptionHandler();
app.MapControllers();
app.Run();
