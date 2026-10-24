using Billing.Api.Application.Handlers.Customers;
using Billing.Api.Application.Handlers.Invoices;
using Billing.Api.Domain;

namespace Billing.Api.Api;

public sealed record CreateCustomerRequest(string Email, string Name, string Password, long CreditLimitMinor);

public sealed record AddInvoiceDocumentRequest(string Name, string ContentBase64);

public static class CustomerEndpoints
{
    public static IEndpointRouteBuilder MapCustomerEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/customers", async (CreateCustomerRequest body, CreateCustomerHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(
                new CreateCustomerCommand(body.Email, body.Name, body.Password, body.CreditLimitMinor), ct))
            .ToHttp(id => Results.Created($"/customers/{id}", new { id = id.Value })));

        app.MapPost("/invoices/{id:guid}/documents", async (Guid id, AddInvoiceDocumentRequest body, AddInvoiceDocumentHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(
                new AddInvoiceDocumentCommand(new InvoiceId(id), body.Name, Convert.FromBase64String(body.ContentBase64)), ct))
            .ToHttp(name => Results.Created($"/invoices/{id}/documents/{name}", null)));

        return app;
    }
}
