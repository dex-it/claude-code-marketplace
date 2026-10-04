using Microsoft.EntityFrameworkCore;
using Tarif.Billing;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<BillingDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Billing")));
builder.Services.AddScoped<SubscriberService>();

var app = builder.Build();

app.MapPost("/leads", async (LeadRequest req, SubscriberService s) =>
    Results.Ok(await s.CreateLeadAsync(req)));

app.MapPost("/subscribers/{id:int}/contract", async (int id, ContractRequest req, SubscriberService s) =>
{
    await s.SignContractAsync(id, req);
    return Results.NoContent();
});

app.MapGet("/subscribers/by-contract/{contractNo}", async (string contractNo, SubscriberService s) =>
    await s.GetByContractAsync(contractNo) is { } dto ? Results.Ok(dto) : Results.NotFound());

app.Run();
