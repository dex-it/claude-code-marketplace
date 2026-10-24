using Fulfil.Contracts;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Fulfil.Kafka;

[BsonIgnoreExtraElements]
public sealed class CustomerDocument
{
    [BsonId] public string Id { get; set; } = "";

    [BsonElement("ordersCount")] public int OrdersCount { get; set; }

    [BsonElement("totalSpent")]
    [BsonRepresentation(BsonType.Decimal128)]
    public decimal TotalSpent { get; set; }
}

[BsonIgnoreExtraElements]
public sealed class OrderLineDocument
{
    public string Sku { get; set; } = "";
    public int Quantity { get; set; }

    [BsonRepresentation(BsonType.Decimal128)]
    public decimal UnitPrice { get; set; }
}

[BsonIgnoreExtraElements]
public sealed class OrderDocument
{
    [BsonId] public string Id { get; set; } = "";
    public string CustomerId { get; set; } = "";
    public string Status { get; set; } = "";
    public List<OrderLineDocument> Lines { get; set; } = [];
    public DateTime PlacedAt { get; set; }
    public bool GiftWrap { get; set; }

    public static OrderDocument From(OrderPlaced e) => new()
    {
        Id = e.OrderId.ToString(),
        CustomerId = e.CustomerId.ToString(),
        Status = nameof(Domain.OrderStatus.Placed),
        Lines = e.ResolveLines().Select(l => new OrderLineDocument { Sku = l.Sku, Quantity = l.Quantity, UnitPrice = l.UnitPrice }).ToList(),
        PlacedAt = e.PlacedAt.UtcDateTime,
        GiftWrap = e.GiftWrap
    };
}
