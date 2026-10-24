using Fulfil.Kafka;
using Fulfil.Options;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

var builder = WebApplication.CreateBuilder(args);
builder.Services.Configure<FulfilOptions>(builder.Configuration.GetSection("Fulfil"));
builder.Services.AddSingleton<IMongoClient>(sp =>
    new MongoClient(sp.GetRequiredService<IOptions<FulfilOptions>>().Value.MongoConnectionString));
builder.Services.AddSingleton(sp =>
    sp.GetRequiredService<IMongoClient>().GetDatabase(sp.GetRequiredService<IOptions<FulfilOptions>>().Value.MongoDatabase));
builder.Services.AddKafkaPipeline();

var app = builder.Build();
app.MapGet("/health", () => Results.Ok());
app.Run();
