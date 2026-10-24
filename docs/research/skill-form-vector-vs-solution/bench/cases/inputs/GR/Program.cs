using Microsoft.EntityFrameworkCore;
using Motorpool.Fleet;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<FleetDbContext>(o =>
    o.UseNpgsql(
        builder.Configuration.GetConnectionString("Fleet"),
        npgsql => npgsql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));
builder.Services.AddScoped<VehicleService>();
builder.Services.AddScoped<TripService>();
builder.Services.AddScoped<DriverService>();

builder.Services.AddAuthentication().AddJwtBearer();
builder.Services.AddAuthorization(o =>
{
    o.AddPolicy("FleetManager", p => p.RequireRole("fleet-manager"));
    o.AddPolicy("Dispatcher", p => p.RequireRole("dispatcher", "fleet-manager"));
    o.AddPolicy("Mechanic", p => p.RequireRole("mechanic", "fleet-manager"));
    o.AddPolicy("Hr", p => p.RequireRole("hr"));
});

var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();

var api = app.MapGroup("/api").RequireAuthorization();

api.MapGet("/drivers/{id:int}", async (int id, DriverService s) =>
    await s.GetAsync(id) is { } d ? Results.Ok(d) : Results.NotFound());

api.MapPut("/drivers/{id:int}/name", async (int id, RenameRequest req, DriverService s) =>
{
    await s.RenameAsync(id, req.DisplayName);
    return Results.NoContent();
}).RequireAuthorization("Hr");

api.MapPut("/drivers/{id:int}/permits", async (int id, List<PermitDto> permits, DriverService s) =>
{
    await s.ReplacePermitsAsync(id, permits);
    return Results.NoContent();
}).RequireAuthorization("Hr");

api.MapGet("/vehicles/by-plate/{plate}", async (string plate, VehicleService s) =>
    await s.FindByPlateAsync(plate) is { } v ? Results.Ok(v) : Results.NotFound());

api.MapPost("/vehicles/{id:int}/decommission", async (int id, VehicleService s) =>
{
    await s.DecommissionAsync(id);
    return Results.NoContent();
}).RequireAuthorization("FleetManager");

api.MapPut("/vehicles/{id:int}/equipment", async (int id, List<EquipmentDto> items, VehicleService s) =>
{
    await s.ReplaceEquipmentAsync(id, items);
    return Results.NoContent();
});

api.MapPost("/inspections/sync", async (List<InspectionDto> batch, VehicleService s) =>
    Results.Ok(await s.SyncInspectionsAsync(batch))).RequireAuthorization("Mechanic");

api.MapGet("/vehicles/{id:int}/trips", async (int id, DateOnly from, DateOnly to, TripService s) =>
    Results.Ok(await s.GetVehicleTripsAsync(id, from, to))).RequireAuthorization("FleetManager");

api.MapGet("/trips/off-days", async (int year, int month, TripService s) =>
    Results.Ok(await s.OffDayTripsAsync(year, month))).RequireAuthorization("FleetManager");

api.MapGet("/waybills/open", async (int? vehicleId, TripService s) =>
    Results.Ok(await s.GetOpenWaybillsAsync(vehicleId))).RequireAuthorization("Dispatcher");

api.MapPost("/trips/start", async (StartTripRequest req, TripService s) =>
{
    try
    {
        return Results.Ok(await s.StartTripAsync(req));
    }
    catch (TripDeniedException ex)
    {
        return Results.Conflict(ex.Message);
    }
}).RequireAuthorization("Dispatcher");

app.Run();

public record RenameRequest(string DisplayName);
