using Billing.Api.Application.Handlers.Customers;
using Billing.Api.Application.Handlers.Invoices;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Portal;

namespace Billing.Api.Api;

public sealed record LoginRequest(string Email, string Password);

public static class PortalEndpoints
{
    private const string CustomerKey = "portal.customer";

    public static IEndpointRouteBuilder MapPortalEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/portal/login", async (LoginRequest body, LoginCustomerHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new LoginCustomerCommand(body.Email, body.Password), ct))
            .ToHttp(token => Results.Ok(new { token })));

        var portal = app.MapGroup("/portal").AddEndpointFilter(RequireCustomer);

        portal.MapGet("/profile", async (HttpContext http, GetCustomerProfileHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new GetCustomerProfileQuery(Current(http)), ct))
            .ToHttp(Results.Ok));

        portal.MapPut("/profile", async (Customer body, HttpContext http, UpdateCustomerProfileHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new UpdateCustomerProfileCommand(Current(http), body), ct))
            .ToHttp(_ => Results.NoContent()));

        portal.MapGet("/invoices", async (HttpContext http, ListCustomerInvoicesHandler handler, CancellationToken ct) =>
            Results.Ok(await handler.HandleAsync(new ListCustomerInvoicesQuery(Current(http)), ct)));

        portal.MapGet("/invoices/{id:guid}", async (Guid id, HttpContext http, GetCustomerInvoiceHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new GetCustomerInvoiceQuery(Current(http), new InvoiceId(id)), ct))
            .ToHttp(Results.Ok));

        portal.MapGet("/invoices/{id:guid}/documents/{name}", async (Guid id, string name, HttpContext http, GetInvoiceDocumentHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new GetInvoiceDocumentQuery(Current(http), new InvoiceId(id), name), ct))
            .ToHttp(doc => Results.File(doc.Content, "application/pdf", doc.Name)));

        return app;
    }

    private static async ValueTask<object?> RequireCustomer(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        var header = http.Request.Headers.Authorization.ToString();
        var customerId = header.StartsWith("Bearer ", StringComparison.Ordinal)
            ? http.RequestServices.GetRequiredService<PortalTokens>().ReadCustomerId(header["Bearer ".Length..])
            : null;
        if (customerId is null)
            return Results.Unauthorized();

        http.Items[CustomerKey] = customerId.Value;
        return await next(context);
    }

    private static CustomerId Current(HttpContext http) => (CustomerId)http.Items[CustomerKey]!;
}
