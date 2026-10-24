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

    public OrderStatusPublisher(IOptions<FulfilOptions> options)
    {
        _producer = new ProducerBuilder<string, string>(new ProducerConfig
        {
            BootstrapServers = options.Value.KafkaBootstrapServers,
            Acks = Acks.All,
            LingerMs = 5
        }).Build();
    }

    public Task PublishStatusAsync(OrderStatusChanged evt, CancellationToken ct)
    {
        _producer.Produce(StatusTopic, new Message<string, string>
        {
            Key = Guid.NewGuid().ToString(),
            Value = JsonSerializer.Serialize(evt, KafkaJson.Options)
        });
        return Task.CompletedTask;
    }

    public Task PublishTouchedAsync(Guid customerId, Guid orderId, CancellationToken ct)
    {
        _producer.Produce(TouchedTopic, new Message<string, string>
        {
            Key = customerId.ToString(),
            Value = JsonSerializer.Serialize(new { customerId, orderId }, KafkaJson.Options)
        });
        return Task.CompletedTask;
    }

    public void Dispose() => _producer.Dispose();
}
