using MassTransit;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Fulfil.Payments;

public sealed class StockLevelsConsumer : IConsumer<StockLevelReported>
{
    private readonly IMongoCollection<BsonDocument> _snapshots;

    public StockLevelsConsumer(IMongoDatabase database) => _snapshots = database.GetCollection<BsonDocument>("stock_snapshots");

    public Task Consume(ConsumeContext<StockLevelReported> context)
    {
        var id = context.MessageId?.ToString() ?? Guid.NewGuid().ToString();
        var doc = new BsonDocument { { "_id", id }, { "sku", context.Message.Sku }, { "quantity", context.Message.Quantity }, { "at", DateTime.UtcNow } };
        return _snapshots.ReplaceOneAsync(new BsonDocument("_id", id), doc, new ReplaceOptions { IsUpsert = true }, context.CancellationToken);
    }
}

public sealed class StockLevelsConsumerDefinition : ConsumerDefinition<StockLevelsConsumer>
{
    protected override void ConfigureConsumer(IReceiveEndpointConfigurator endpointConfigurator,
        IConsumerConfigurator<StockLevelsConsumer> consumerConfigurator, IRegistrationContext context)
    {
        endpointConfigurator.UseMessageRetry(r => r.Intervals(100, 500, 1000));
        endpointConfigurator.UseInMemoryOutbox(context);
    }
}
