using Microsoft.EntityFrameworkCore;
using VetClinic.Records.Data;
using VetClinic.Records.Domain;
using VetClinic.Records.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<ClinicDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Records")));
builder.Services.AddScoped<ClinicCardService>();

var app = builder.Build();

app.MapGet("/pets/{id:int}", async (int id, ClinicCardService s) =>
    await s.GetPetCardAsync(id) is { } card ? Results.Ok(card) : Results.NotFound());

app.MapGet("/vets/{vetName}/planned", (string vetName, ClinicCardService s) =>
    s.GetPlannedVisitsAsync(vetName));

app.MapPost("/pets/{id:int}/allergies", async (int id, AllergyInput input, ClinicCardService s) =>
{
    await s.AddAllergyAsync(id, input);
    return Results.NoContent();
});

app.MapPut("/visits/{id:int}/notes", async (int id, string? notes, ClinicCardService s) =>
{
    await s.UpdateVisitNotesAsync(id, notes);
    return Results.NoContent();
});

app.Run();
