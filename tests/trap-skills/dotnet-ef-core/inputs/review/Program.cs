using Shop.Data;
using Shop.Data.Services;
using Shop.Data.Workers;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext<ShopDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Shop")).UseLazyLoadingProxies());
builder.Services.AddScoped<OrderRepository>();
builder.Services.AddScoped<OrderQueries>();
builder.Services.AddScoped<OrderAdmin>();
builder.Services.AddScoped<CatalogService>();
builder.Services.AddHostedService<OverdueNotifier>();
var app = builder.Build();
app.Run();
