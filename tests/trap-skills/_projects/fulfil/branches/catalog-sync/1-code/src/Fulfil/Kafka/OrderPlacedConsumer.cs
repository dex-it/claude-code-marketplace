using System.Text;
using System.Text.Json;
using Confluent.Kafka;
using Fulfil.Contracts;
using Fulfil.Domain;
using Fulfil.Options;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Fulfil.Kafka;

public sealed class OrderPlacedConsumer : BackgroundService
{
    private const string Topic = "orders.placed";
    private const int MaxAttempts = 3;

    private readonly FulfilOptions _options;
    private readonly OrderStatusPublisher _publisher;
    private readonly ILogger<OrderPlacedConsumer> _logger;
    private readonly IMongoCollection<CustomerDocument> _customers;
    private readonly IMongoCollection<OrderDocument> _orders;
    private readonly IMongoCollection<BsonDocument> _processed;

    public OrderPlacedConsumer(IOptions<FulfilOptions> options, IMongoDatabase database,
        OrderStatusPublisher publisher, ILogger<OrderPlacedConsumer> logger)
    {
        _options = options.Value;
        _publisher = publisher;
        _logger = logger;
        _customers = database.GetCollection<CustomerDocument>("customers");
        _orders = database.GetCollection<OrderDocument>("orders");
        _processed = database.GetCollection<BsonDocument>("processed_orders");
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await Task.Yield();
        var config = new ConsumerConfig
        {
            BootstrapServers = _options.KafkaBootstrapServers,
            GroupId = "fulfil-orders",
            AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = false,
            EnableAutoOffsetStore = false
        };
        using var consumer = new ConsumerBuilder<string, string>(config).Build();
        consumer.Subscribe(Topic);
        try
        {
            while (!ct.IsCancellationRequested)
            {
                var result = consumer.Consume(ct);
                await HandleWithRetryAsync(result, ct);
                consumer.Commit(result);
            }
        }
        catch (OperationCanceledException)
        {
        }
        finally
        {
            consumer.Close();
        }
    }

    private async Task HandleWithRetryAsync(ConsumeResult<string, string> result, CancellationToken ct)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await HandleAsync(result, ct);
                return;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning("Попытка {Attempt} разбора {Partition}/{Offset} не удалась: {Error}",
                    attempt, result.Partition.Value, result.Offset.Value, ex.GetType().Name);
                if (attempt >= MaxAttempts)
                {
                    await _publisher.SendAsync(Topic + ".DLT", new Message<string, string>
                    {
                        Key = result.Message.Key,
                        Value = result.Message.Value,
                        Headers = new Headers { { "error", Encoding.UTF8.GetBytes(ex.GetType().Name) } }
                    }, ct);
                    return;
                }
                await Task.Delay(TimeSpan.FromSeconds(attempt), ct);
            }
        }
    }

    private async Task HandleAsync(ConsumeResult<string, string> result, CancellationToken ct)
    {
        var evt = JsonSerializer.Deserialize<OrderPlaced>(result.Message.Value, KafkaJson.Options)
                  ?? throw new JsonException("empty payload");
        var orderId = evt.OrderId.ToString();

        await _orders.ReplaceOneAsync(o => o.Id == orderId, OrderDocument.From(evt),
            new ReplaceOptions { IsUpsert = true }, ct);

        if (await TryMarkProcessedAsync(orderId, ct))
        {
            var total = evt.ResolveLines().Sum(l => l.Quantity * l.UnitPrice);
            try
            {
                await _customers.UpdateOneAsync(c => c.Id == evt.CustomerId.ToString(),
                    Builders<CustomerDocument>.Update.Inc(c => c.OrdersCount, 1).Inc(c => c.TotalSpent, total),
                    new UpdateOptions { IsUpsert = true }, ct);
            }
            catch
            {
                await _processed.DeleteOneAsync(new BsonDocument("_id", orderId), CancellationToken.None);
                throw;
            }
            _logger.LogInformation("Заказ {OrderId} учтён", orderId);
        }

        await _publisher.PublishStatusAsync(new OrderStatusChanged(evt.OrderId, OrderStatus.Placed, DateTimeOffset.UtcNow), ct);
        await _publisher.PublishTouchedAsync(evt.CustomerId, evt.OrderId, ct);
    }

    private async Task<bool> TryMarkProcessedAsync(string orderId, CancellationToken ct)
    {
        try
        {
            await _processed.InsertOneAsync(new BsonDocument { { "_id", orderId }, { "at", DateTime.UtcNow } }, cancellationToken: ct);
            return true;
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            return false;
        }
    }
}
