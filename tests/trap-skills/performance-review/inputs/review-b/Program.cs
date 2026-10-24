using Catalog.Worker.Data;
using Catalog.Worker.Import;
using Catalog.Worker.Pricing;
using Microsoft.EntityFrameworkCore;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddDbContext<CatalogDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Catalog")));
builder.Services.AddSingleton<CatalogEvents>();
builder.Services.AddScoped<CatalogImportJob>();
builder.Services.AddHostedService<ImportScheduler>();
builder.Services.AddHostedService<PriceSyncWorker>();

builder.Build().Run();
