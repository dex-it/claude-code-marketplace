using Fulfil.Domain;
using MassTransit;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver;

namespace Fulfil.Payments;

public sealed record SubmitOrderRequest(Guid CustomerId, List<OrderLine> Lines, decimal Discount, string ReceiptEmail);

[BsonIgnoreExtraElements]
public sealed class SubmittedOrder
{
    [BsonId] public string Id { get; set; } = "";
    public string CustomerId { get; set; } = "";
    public string Status { get; set; } = "";
    public List<OrderLine> Lines { get; set; } = [];

    [BsonRepresentation(BsonType.Decimal128)] public decimal Total { get; set; }
    [BsonRepresentation(BsonType.Decimal128)] public decimal Discount { get; set; }
    public string ReceiptEmail { get; set; } = "";
    public DateTime PlacedAt { get; set; }
}

public static class SubmitOrderEndpoint
{
    public static void MapSubmitOrder(this IEndpointRouteBuilder app) =>
        app.MapPost("/orders/{id:guid}/submit", async (Guid id, SubmitOrderRequest request, IMongoDatabase database, IPublishEndpoint publish, CancellationToken ct) =>
        {
            if (request.Lines.Count == 0) return Results.BadRequest();
            var order = new SubmittedOrder
            {
                Id = id.ToString(),
                CustomerId = request.CustomerId.ToString(),
                Status = nameof(OrderStatus.Placed),
                Lines = request.Lines,
                Total = request.Lines.Sum(l => l.Quantity * l.UnitPrice),
                Discount = request.Discount,
                ReceiptEmail = request.ReceiptEmail,
                PlacedAt = DateTime.UtcNow
            };
            await database.GetCollection<SubmittedOrder>("orders").InsertOneAsync(order, cancellationToken: ct);
            await publish.Publish(new OrderSubmitted(id, order.Total, order.Discount, order.ReceiptEmail, order.Lines), ct);
            return Results.Accepted($"/orders/{id}");
        });
}
