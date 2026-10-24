using System.Text;
using System.Text.Json;
using Fulfil.Options;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace Fulfil.Payments;

public sealed class WarehouseInboundConsumer : BackgroundService
{
    private const string InboundQueue = "warehouse.inbound";
    private const string OutboundExchange = "warehouse.outbound";

    private sealed record InboundStock(string Sku, int Qty, string MessageId);

    private readonly FulfilOptions _options;
    private readonly IMongoCollection<BsonDocument> _products;
    private readonly ILogger<WarehouseInboundConsumer> _logger;

    public WarehouseInboundConsumer(IOptions<FulfilOptions> options, IMongoDatabase database, ILogger<WarehouseInboundConsumer> logger)
    {
        _options = options.Value;
        _products = database.GetCollection<BsonDocument>("products");
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        var factory = new ConnectionFactory { HostName = _options.RabbitMqHost };
        await using var connection = await factory.CreateConnectionAsync(ct);
        await using var channel = await connection.CreateChannelAsync(
            new CreateChannelOptions(publisherConfirmationsEnabled: true, publisherConfirmationTrackingEnabled: true),
            ct);

        await channel.QueueDeclareAsync(InboundQueue, durable: false, exclusive: false, autoDelete: false, cancellationToken: ct);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += async (_, ea) =>
        {
            try
            {
                await HandleAsync(channel, ea, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError("Сообщение склада {DeliveryTag} отклонено: {Error}", ea.DeliveryTag, ex.GetType().Name);
            }
        };
        await channel.BasicConsumeAsync(InboundQueue, autoAck: true, consumer, ct);

        try
        {
            await Task.Delay(Timeout.Infinite, ct);
        }
        catch (OperationCanceledException)
        {
        }
    }

    private async Task HandleAsync(IChannel channel, BasicDeliverEventArgs ea, CancellationToken ct)
    {
        var msg = JsonSerializer.Deserialize<InboundStock>(ea.Body.Span, JsonSerializerOptions.Web)
                  ?? throw new JsonException("empty payload");
        if (msg.Qty <= 0) throw new InvalidOperationException("quantity must be positive");

        await _products.UpdateOneAsync(new BsonDocument("_id", msg.Sku),
            Builders<BsonDocument>.Update.Inc("stock", msg.Qty), new UpdateOptions { IsUpsert = true }, ct);

        var body = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { msg.MessageId, status = "applied" }, JsonSerializerOptions.Web));
        await channel.BasicPublishAsync(OutboundExchange, string.Empty, false,
            new BasicProperties { MessageId = msg.MessageId, ContentType = "application/json" }, body, ct);
    }
}
