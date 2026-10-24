using System.Text.Json;
using Confluent.Kafka;
using Fulfil.Contracts;
using Fulfil.Domain;
using Fulfil.Options;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace Fulfil.Kafka;

public sealed class OrderPlacedConsumer : BackgroundService
{
    private const string Topic = "orders.placed";

    private readonly FulfilOptions _options;
    private readonly OrderStatusPublisher _publisher;
    private readonly ILogger<OrderPlacedConsumer> _logger;
    private readonly IMongoCollection<CustomerDocument> _customers;
    private readonly IMongoCollection<OrderDocument> _orders;

    public OrderPlacedConsumer(IOptions<FulfilOptions> options, IMongoDatabase database,
        OrderStatusPublisher publisher, ILogger<OrderPlacedConsumer> logger)
    {
        _options = options.Value;
        _publisher = publisher;
        _logger = logger;
        _customers = database.GetCollection<CustomerDocument>("customers");
        _orders = database.GetCollection<OrderDocument>("orders");
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await Task.Yield();
        var config = new ConsumerConfig
        {
            BootstrapServers = _options.KafkaBootstrapServers,
            GroupId = "fulfil-orders",
            AutoOffsetReset = AutoOffsetReset.Earliest
        };
        using var consumer = new ConsumerBuilder<string, string>(config).Build();
        consumer.Subscribe(Topic);
        try
        {
            while (!ct.IsCancellationRequested)
            {
                var result = consumer.Consume(ct);
                await HandleWithRetryAsync(result, ct);
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
        while (true)
        {
            try
            {
                await HandleAsync(result, ct);
                return;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning("Не удалось обработать {Partition}/{Offset}: {Error}",
                    result.Partition.Value, result.Offset.Value, ex.GetType().Name);
                await Task.Delay(TimeSpan.FromSeconds(5), ct);
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

        var total = evt.Items.Sum(l => l.Quantity + l.UnitPrice);
        await _customers.UpdateOneAsync(c => c.Id == evt.CustomerId.ToString(),
            Builders<CustomerDocument>.Update.Inc(c => c.OrdersCount, 1).Inc(c => c.TotalSpent, total),
            new UpdateOptions { IsUpsert = true }, ct);
        _logger.LogInformation("Заказ {OrderId} клиента {Email} учтён", orderId, evt.ContactEmail);

        await _publisher.PublishStatusAsync(new OrderStatusChanged(evt.OrderId, OrderStatus.Placed, DateTimeOffset.UtcNow), ct);
        await _publisher.PublishTouchedAsync(evt.CustomerId, evt.OrderId, ct);
    }
}
