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
    private readonly IMongoCollection<BsonDocument> _processed;
    private readonly ILogger<WarehouseInboundConsumer> _logger;

    public WarehouseInboundConsumer(IOptions<FulfilOptions> options, IMongoDatabase database, ILogger<WarehouseInboundConsumer> logger)
    {
        _options = options.Value;
        _products = database.GetCollection<BsonDocument>("products");
        _processed = database.GetCollection<BsonDocument>("inbound_processed");
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        var factory = new ConnectionFactory { HostName = _options.RabbitMqHost };
        await using var connection = await factory.CreateConnectionAsync(ct);
        await using var channel = await connection.CreateChannelAsync(
            new CreateChannelOptions(publisherConfirmationsEnabled: true, publisherConfirmationTrackingEnabled: true),
            ct);

        await channel.QueueDeclareAsync(InboundQueue, durable: true, exclusive: false, autoDelete: false, cancellationToken: ct);
        await channel.BasicQosAsync(0, 20, false, ct);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += async (_, ea) =>
        {
            try
            {
                await HandleAsync(channel, ea, ct);
                await channel.BasicAckAsync(ea.DeliveryTag, false, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError("Сообщение склада {DeliveryTag} отклонено: {Error}", ea.DeliveryTag, ex.GetType().Name);
                await channel.BasicNackAsync(ea.DeliveryTag, false, false, ct);
            }
        };
        await channel.BasicConsumeAsync(InboundQueue, autoAck: false, consumer, ct);

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

        if (await TryMarkProcessedAsync(msg.MessageId, ct))
        {
            try
            {
                await _products.UpdateOneAsync(new BsonDocument("_id", msg.Sku),
                    Builders<BsonDocument>.Update.Inc("stock", msg.Qty), new UpdateOptions { IsUpsert = true }, ct);
            }
            catch
            {
                await _processed.DeleteOneAsync(new BsonDocument("_id", msg.MessageId), CancellationToken.None);
                throw;
            }
        }

        var body = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { msg.MessageId, status = "applied" }, JsonSerializerOptions.Web));
        await channel.BasicPublishAsync(OutboundExchange, string.Empty, false,
            new BasicProperties { Persistent = true, MessageId = msg.MessageId, ContentType = "application/json" }, body, ct);
    }

    private async Task<bool> TryMarkProcessedAsync(string messageId, CancellationToken ct)
    {
        try
        {
            await _processed.InsertOneAsync(new BsonDocument { { "_id", messageId }, { "at", DateTime.UtcNow } }, cancellationToken: ct);
            return true;
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            return false;
        }
    }
}
