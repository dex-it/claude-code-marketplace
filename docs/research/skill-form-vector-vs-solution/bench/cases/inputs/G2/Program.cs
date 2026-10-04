using FlowStudio.Schedule;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<StudioDbContext>(o =>
    o.UseNpgsql(
        builder.Configuration.GetConnectionString("Studio"),
        npgsql => npgsql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));

builder.Services.AddScoped<ScheduleService>();
builder.Services.AddHostedService<TurnstileWorker>();

var app = builder.Build();

app.MapGet("/courses/{id:int}", async (int id, ScheduleService s) =>
    await s.GetCourseAsync(id) is { } c ? Results.Ok(c) : Results.NotFound());

app.MapPost("/courses/{id:int}/publish", async (int id, ScheduleService s) =>
{
    await s.PublishAsync(id);
    return Results.NoContent();
});

app.MapPost("/sessions/{id:int}/enroll", async (int id, EnrollRequest req, ScheduleService s) =>
    Results.Ok(await s.EnrollAsync(req.CardNumber, id)));

app.MapDelete("/enrollments/{id:int}", async (int id, ScheduleService s) =>
{
    await s.CancelEnrollmentAsync(id);
    return Results.NoContent();
});

app.Run();

public record EnrollRequest(string CardNumber);
