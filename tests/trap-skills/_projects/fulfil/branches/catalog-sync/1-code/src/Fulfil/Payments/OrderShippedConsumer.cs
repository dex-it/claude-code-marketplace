using MassTransit;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Fulfil.Payments;

public sealed class OrderShippedConsumer : IConsumer<OrderShipped>
{
    private readonly IMongoCollection<BsonDocument> _orders;

    public OrderShippedConsumer(IMongoDatabase database) => _orders = database.GetCollection<BsonDocument>("orders");

    public Task Consume(ConsumeContext<OrderShipped> context) =>
        _orders.UpdateOneAsync(new BsonDocument("_id", context.Message.OrderId.ToString()),
            Builders<BsonDocument>.Update.Set("status", "Shipped").Set("shippedAt", DateTime.UtcNow),
            cancellationToken: context.CancellationToken);
}
