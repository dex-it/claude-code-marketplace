using Billing.Api.Application.Handlers.Subscriptions;
using Billing.Api.Domain;

namespace Billing.Api.Api;

public sealed record SubscriptionItemRequest(string Service, int Quantity, long IncludedUnits);

public sealed record CreateSubscriptionRequest(
    Guid CustomerId,
    string Currency,
    IReadOnlyList<SubscriptionItemRequest> Items,
    long MonthlyTotalMinor);

public sealed record ChangePriceRequest(Guid Id, Guid ItemId, long Value, DateOnly Date);

public sealed record RecordUsageRequest(long Units);

public sealed record SuspendRequest(string Reason);

public static class SubscriptionEndpoints
{
    public static IEndpointRouteBuilder MapSubscriptionEndpoints(this IEndpointRouteBuilder app)
    {
        var subscriptions = app.MapGroup("/subscriptions");

        subscriptions.MapPost("/", async (CreateSubscriptionRequest body, CreateSubscriptionHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new CreateSubscriptionCommand(
                new CustomerId(body.CustomerId),
                body.Currency,
                body.Items.Select(i => new SubscriptionItemInput(i.Service, i.Quantity, i.IncludedUnits)).ToList(),
                body.MonthlyTotalMinor), ct))
            .ToHttp(id => Results.Created($"/subscriptions/{id}", new { id = id.Value })));

        subscriptions.MapGet("/{id:guid}", async (Guid id, GetSubscriptionHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new GetSubscriptionQuery(new SubscriptionId(id)), ct))
            .ToHttp(view => Results.Ok(view)));

        subscriptions.MapPost("/{id:guid}/items", async (Guid id, SubscriptionItemRequest body, AddSubscriptionItemHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new AddSubscriptionItemCommand(
                new SubscriptionId(id), new SubscriptionItemInput(body.Service, body.Quantity, body.IncludedUnits)), ct))
            .ToHttp(itemId => Results.Ok(new { itemId })));

        subscriptions.MapPost("/price", async (ChangePriceRequest body, ChangeItemPriceHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new ChangeItemPriceCommand(new SubscriptionId(body.Id), body.ItemId, body.Value, body.Date), ct))
            .ToHttp(_ => Results.NoContent()));

        subscriptions.MapPost("/items/{itemId:guid}/usage", async (Guid itemId, RecordUsageRequest body, RecordUsageHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new RecordUsageCommand(itemId, body.Units), ct))
            .ToHttp(_ => Results.NoContent()));

        subscriptions.MapPost("/{id:guid}/suspend", async (Guid id, SuspendRequest body, SuspendSubscriptionHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new SuspendSubscriptionCommand(new SubscriptionId(id), body.Reason), ct))
            .ToHttp(_ => Results.NoContent()));

        subscriptions.MapPost("/{id:guid}/resume", async (Guid id, ResumeSubscriptionHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new ResumeSubscriptionCommand(new SubscriptionId(id)), ct))
            .ToHttp(_ => Results.NoContent()));

        var backoffice = app.MapGroup("/backoffice/subscriptions");

        backoffice.MapGet("/due-today", async (GetDueSubscriptionsHandler handler, CancellationToken ct) =>
            Results.Ok(await handler.HandleAsync(ct)));

        backoffice.MapGet("/stale", async (StaleSubscriptionsHandler handler, CancellationToken ct) =>
            Results.Ok(await handler.HandleAsync(ct)));

        return app;
    }
}
