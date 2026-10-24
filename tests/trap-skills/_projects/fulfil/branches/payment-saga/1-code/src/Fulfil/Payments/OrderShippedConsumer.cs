using MassTransit;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Fulfil.Payments;

public sealed class OrderShippedConsumer : IConsumer<OrderShipped>
{
    private readonly IMongoCollection<BsonDocument> _orders;

    private readonly IMongoCollection<BsonDocument> _payments;

    public OrderShippedConsumer(IMongoDatabase database)
    {
        _orders = database.GetCollection<BsonDocument>("orders");
        _payments = database.GetCollection<BsonDocument>("payments");
    }

    public async Task Consume(ConsumeContext<OrderShipped> context)
    {
        var id = context.Message.OrderId.ToString();
        var payment = await _payments.Find(new BsonDocument("_id", id)).FirstOrDefaultAsync(context.CancellationToken)
                      ?? throw new InvalidOperationException($"Payment for order {id} not found");
        await _orders.UpdateOneAsync(new BsonDocument("_id", id),
            Builders<BsonDocument>.Update.Set("status", "Shipped").Set("shippedAt", DateTime.UtcNow)
                .Set("receiptAmount", payment["amount"]),
            cancellationToken: context.CancellationToken);
    }
}
