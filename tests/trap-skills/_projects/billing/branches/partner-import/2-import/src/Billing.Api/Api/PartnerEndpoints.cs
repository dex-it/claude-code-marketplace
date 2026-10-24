using Billing.Api.Application.Partners;
using Newtonsoft.Json;

namespace Billing.Api.Api;

public static class PartnerEndpoints
{
    public static IEndpointRouteBuilder MapPartnerEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/partners/{partnerId:guid}/invoices/import", async (Guid partnerId, HttpRequest http, ImportPartnerInvoicesHandler handler, CancellationToken ct) =>
        {
            using var reader = new StreamReader(http.Body);
            PartnerImportRequest? request;
            try
            {
                request = JsonConvert.DeserializeObject<PartnerImportRequest>(await reader.ReadToEndAsync(ct));
            }
            catch (JsonException ex)
            {
                return Results.Problem(ex.Message, statusCode: 400, extensions: new Dictionary<string, object?> { ["code"] = "validation" });
            }
            if (request is null)
                return Results.Problem("Empty body", statusCode: 400, extensions: new Dictionary<string, object?> { ["code"] = "validation" });

            var outcome = await handler.HandleAsync(partnerId, request, ct);
            return outcome.Errors.Count > 0
                ? Results.BadRequest(new { errors = outcome.Errors })
                : Results.Ok(new { created = outcome.Created.Select(id => id.Value) });
        });
        return app;
    }
}
