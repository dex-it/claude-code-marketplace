using Fulfil.Caching;
using Fulfil.Options;

var builder = WebApplication.CreateBuilder(args);
builder.Services.Configure<FulfilOptions>(builder.Configuration.GetSection("Fulfil"));
builder.Services.AddRedisCaching();

var app = builder.Build();
app.UseWhen(c => c.Request.Path.StartsWithSegments("/api"), b => b.UseMiddleware<ApiKeyRateLimiter>());
app.MapGet("/health", () => Results.Ok());
app.MapPriceEndpoints();
app.Run();
