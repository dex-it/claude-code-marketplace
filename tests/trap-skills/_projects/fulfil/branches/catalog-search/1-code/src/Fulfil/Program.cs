using Fulfil.Options;
using Fulfil.Search;

var builder = WebApplication.CreateBuilder(args);
builder.Services.Configure<FulfilOptions>(builder.Configuration.GetSection("Fulfil"));
builder.Services.AddProductSearch();

var app = builder.Build();
app.MapGet("/health", () => Results.Ok());
app.MapProductSearch();
app.Run();
