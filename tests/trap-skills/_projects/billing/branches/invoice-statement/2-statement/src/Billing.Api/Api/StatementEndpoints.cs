using Billing.Api.Application.Handlers.Statements;
using Billing.Api.Application.Statements;
using Billing.Api.Domain;

namespace Billing.Api.Api;

public static class StatementEndpoints
{
    public static IEndpointRouteBuilder MapStatementEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/customers/{id:guid}/statement", async (
                Guid id,
                DateOnly from,
                DateOnly to,
                string currency,
                BuildStatementHandler handler,
                StatementFormatterRegistry formatters,
                CancellationToken ct) =>
            (await handler.HandleAsync(new BuildStatementQuery(new CustomerId(id), from, to, currency), ct))
            .ToStatementResult(statement =>
            {
                var formatter = formatters.Resolve(StatementFormat.Json);
                return Results.File(formatter.Render(statement, new StatementRenderOptions()), formatter.ContentType);
            }));

        return app;
    }
}
