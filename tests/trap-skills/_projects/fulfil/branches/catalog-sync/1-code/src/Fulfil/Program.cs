using Fulfil.Archive;
using Fulfil.Caching;
using Fulfil.Kafka;
using Fulfil.Options;
using Fulfil.Payments;
using Fulfil.Search;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

var builder = WebApplication.CreateBuilder(args);
builder.Services.Configure<FulfilOptions>(builder.Configuration.GetSection("Fulfil"));
builder.Services.AddSingleton<IMongoClient>(sp =>
    new MongoClient(sp.GetRequiredService<IOptions<FulfilOptions>>().Value.MongoConnectionString));
builder.Services.AddSingleton(sp =>
    sp.GetRequiredService<IMongoClient>().GetDatabase(sp.GetRequiredService<IOptions<FulfilOptions>>().Value.MongoDatabase));
builder.Services.AddKafkaPipeline();
builder.Services.AddPaymentSaga();
builder.Services.AddRedisCaching();
builder.Services.AddOrderArchive();
builder.Services.AddProductSearch();

var app = builder.Build();
app.UseWhen(c => c.Request.Path.StartsWithSegments("/api"), b => b.UseMiddleware<ApiKeyRateLimiter>());
app.MapGet("/health", () => Results.Ok());
app.MapSubmitOrder();
app.MapPriceEndpoints();
app.MapProductSearch();
app.Run();
