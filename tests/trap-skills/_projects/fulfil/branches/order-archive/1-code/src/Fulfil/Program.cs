using Fulfil.Archive;
using Fulfil.Options;

var builder = WebApplication.CreateBuilder(args);
builder.Services.Configure<FulfilOptions>(builder.Configuration.GetSection("Fulfil"));
builder.Services.AddOrderArchive();

var app = builder.Build();
app.MapGet("/health", () => Results.Ok());
app.Run();
