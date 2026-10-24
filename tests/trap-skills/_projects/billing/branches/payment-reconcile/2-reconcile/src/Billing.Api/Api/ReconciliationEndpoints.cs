using System.Globalization;
using Billing.Api.Infrastructure.Reconciliation;

namespace Billing.Api.Api;

public static class ReconciliationEndpoints
{
    public static IEndpointRouteBuilder MapReconciliationEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/reconciliation/{date}", (string date, ReconciliationReports reports, ILoggerFactory loggers) =>
        {
            var logger = loggers.CreateLogger(typeof(ReconciliationEndpoints));
            if (!DateOnly.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var day))
            {
                logger.LogWarning("Invalid reconciliation date {Date}", date);
                return Results.Problem("Date must be yyyy-MM-dd", statusCode: 400, extensions: new Dictionary<string, object?> { ["code"] = "validation" });
            }
            if (!reports.ByDay.TryGetValue(day, out var lines))
            {
                logger.LogError("Reconciliation report for {Day} not found", day);
                return Results.Problem($"No report for {day}", statusCode: 404, extensions: new Dictionary<string, object?> { ["code"] = "reconciliation.not_found" });
            }
            return Results.Ok(new { day, mismatches = lines });
        });
        return app;
    }
}
