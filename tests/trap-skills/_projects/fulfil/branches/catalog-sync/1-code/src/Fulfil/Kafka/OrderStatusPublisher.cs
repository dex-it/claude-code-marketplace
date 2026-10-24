using System.Text;
using System.Text.Json;
using Confluent.Kafka;
using Fulfil.Contracts;
using Fulfil.Options;
using Microsoft.Extensions.Options;

namespace Fulfil.Kafka;

public sealed class OrderStatusPublisher : IDisposable
{
    public const string StatusTopic = "orders.status-changed";
    public const string TouchedTopic = "customers.touched";

    private readonly IProducer<string, string> _producer;
    private readonly ILogger<OrderStatusPublisher> _logger;

    public OrderStatusPublisher(IOptions<FulfilOptions> options, ILogger<OrderStatusPublisher> logger)
    {
        _logger = logger;
        _producer = new ProducerBuilder<string, string>(new ProducerConfig
        {
            BootstrapServers = options.Value.KafkaBootstrapServers,
            Acks = Acks.All,
            EnableIdempotence = true,
            LingerMs = 5
        }).Build();
    }

    public Task PublishStatusAsync(OrderStatusChanged evt, CancellationToken ct) =>
        SendAsync(StatusTopic, new Message<string, string>
        {
            Key = evt.OrderId.ToString(),
            Value = JsonSerializer.Serialize(evt, KafkaJson.Options)
        }, ct);

    public Task PublishTouchedAsync(Guid customerId, Guid orderId, CancellationToken ct) =>
        SendAsync(TouchedTopic, new Message<string, string>
        {
            Key = customerId.ToString(),
            Value = JsonSerializer.Serialize(new { customerId, orderId }, KafkaJson.Options)
        }, ct);

    public async Task SendAsync(string topic, Message<string, string> message, CancellationToken ct)
    {
        try
        {
            await _producer.ProduceAsync(topic, message, ct);
        }
        catch (ProduceException<string, string> ex)
        {
            _logger.LogError("Не доставлено в {Topic}: {Reason}", topic, ex.Error.Reason);
            throw;
        }
    }

    public void Dispose()
    {
        _producer.Flush(TimeSpan.FromSeconds(10));
        _producer.Dispose();
    }
}
