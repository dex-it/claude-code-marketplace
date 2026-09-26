using Microsoft.EntityFrameworkCore;
using Orders.Api.Data;
using Orders.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<OrdersDbContext>(o => o
    .UseNpgsql(builder.Configuration.GetConnectionString("Orders"))
    .UseLazyLoadingProxies());

builder.Services.AddHttpClient<IRateService, RateService>(c =>
    c.BaseAddress = new Uri(builder.Configuration["Rates:BaseUrl"]!));
builder.Services.AddSingleton<CurrencyConverter>();
builder.Services.AddSingleton<PdfRenderer>();
builder.Services.AddControllers();

var app = builder.Build();
app.MapControllers();
app.Run();
