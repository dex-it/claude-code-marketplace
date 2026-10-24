using System.Reflection;
using System.Text.Json;
using Depot.Api;
using Depot.Api.Handlers;
using Depot.Contracts;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings__Default не задана");
var apiKey = builder.Configuration["Auth:ApiKey"]
    ?? throw new InvalidOperationException("Auth__ApiKey не задан");

builder.Services.AddSingleton(NpgsqlDataSource.Create(connectionString));
builder.Services.AddSingleton(new ApiKeyOptions(apiKey));

// Обработчики событий склада находятся по интерфейсу: любой тип сборки, реализующий IStockHandler.
foreach (var type in Assembly.GetExecutingAssembly().GetTypes()
             .Where(t => typeof(IStockHandler).IsAssignableFrom(t) && t is { IsInterface: false, IsAbstract: false }))
    builder.Services.AddSingleton(typeof(IStockHandler), type);

var app = builder.Build();

await Migrator.RunAsync(app.Services.GetRequiredService<NpgsqlDataSource>());

app.Use(async (ctx, next) =>
{
    if (ctx.Request.Path.StartsWithSegments("/health")) { await next(); return; }
    if (ctx.Request.Headers["X-Api-Key"] != app.Services.GetRequiredService<ApiKeyOptions>().Key)
    { ctx.Response.StatusCode = 401; return; }
    await next();
});

app.MapGet("/health", async (NpgsqlDataSource db) =>
{
    await using var cmd = db.CreateCommand("select 1");
    await cmd.ExecuteScalarAsync();
    return Results.Ok();
});

app.MapGet("/stock/{sku}", async (string sku, NpgsqlDataSource db) =>
{
    await using var cmd = db.CreateCommand("select warehouse, quantity from stock where sku = $1");
    cmd.Parameters.AddWithValue(sku);
    var rows = new List<StockDto>();
    await using var r = await cmd.ExecuteReaderAsync();
    while (await r.ReadAsync()) rows.Add(new StockDto(sku, r.GetString(0), r.GetInt32(1)));
    return Results.Json(rows, JsonSerializerOptions.Default);
});

app.MapPost("/stock/{sku}/receive", async (string sku, ReceiveRequest req, NpgsqlDataSource db, IEnumerable<IStockHandler> handlers) =>
{
    await using var cmd = db.CreateCommand(
        "insert into stock(sku, warehouse, quantity) values ($1, $2, $3) " +
        "on conflict (sku, warehouse) do update set quantity = stock.quantity + excluded.quantity");
    cmd.Parameters.AddWithValue(sku);
    cmd.Parameters.AddWithValue(req.Warehouse);
    cmd.Parameters.AddWithValue(req.Quantity);
    await cmd.ExecuteNonQueryAsync();
    foreach (var h in handlers) await h.OnReceivedAsync(sku, req);
    return Results.NoContent();
});

app.Run();

public partial class Program;
