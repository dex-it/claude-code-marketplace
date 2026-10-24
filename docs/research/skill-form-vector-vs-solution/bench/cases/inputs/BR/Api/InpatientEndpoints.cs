using VetClinic.Hospital.Services;

namespace VetClinic.Hospital.Api;

public record DischargeRequest(DateOnly DischargedOn);

public static class InpatientEndpoints
{
    public static void MapInpatient(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/inpatient");

        g.MapGet("/wards/{ward}/patients", (string ward, WardService s) => s.GetWardPatientsAsync(ward))
            .RequireAuthorization();

        g.MapGet("/long-stays", (WardService s) => s.GetLongStaysAsync())
            .RequireAuthorization("Vet");

        g.MapGet("/boxes/{id:int}", async (int id, WardService s) =>
                await s.GetBoxCardAsync(id) is { } card ? Results.Ok(card) : Results.NotFound())
            .RequireAuthorization();

        g.MapGet("/pets/{petId:int}/latest-stay", async (int petId, WardService s) =>
                await s.GetLatestStayAsync(petId) is { } stay ? Results.Ok(stay) : Results.NotFound())
            .RequireAuthorization("Vet");

        g.MapPut("/stays/{id:int}/medications",
                async (int id, List<MedicationOrderInput> orders, WardService s) =>
                {
                    await s.ReplaceMedicationPlanAsync(id, orders);
                    return Results.NoContent();
                })
            .RequireAuthorization("Vet");

        g.MapPost("/boxes/{id:int}/decommission", async (int id, WardService s) =>
                {
                    await s.DecommissionBoxAsync(id);
                    return Results.NoContent();
                })
            .RequireAuthorization("Admin");

        g.MapPost("/stays/{id:int}/discharge", async (int id, DischargeRequest r, WardService s) =>
                Results.Ok(new { total = await s.DischargeAsync(id, r.DischargedOn) }))
            .RequireAuthorization();

        g.MapGet("/reports/occupancy", (string ward, string sortBy, InpatientReportService s) =>
                s.GetOccupancyAsync(ward, sortBy))
            .RequireAuthorization();

        g.MapGet("/pets/{petId:int}/history", (int petId, InpatientReportService s) => s.GetPetHistoryAsync(petId))
            .RequireAuthorization();
    }
}
