using System.Text.Json;
using Confluent.Kafka;
using Fulfil.Contracts;
using Fulfil.Options;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace Fulfil.Kafka;

public sealed class OrderImportConsumer : BackgroundService
{
    private const int BatchSize = 100;
    private const int CommitEveryBatches = 10;

    private readonly FulfilOptions _options;
    private readonly IMongoCollection<OrderDocument> _orders;
    private readonly ILogger<OrderImportConsumer> _logger;

    public OrderImportConsumer(IOptions<FulfilOptions> options, IMongoDatabase database, ILogger<OrderImportConsumer> logger)
    {
        _options = options.Value;
        _orders = database.GetCollection<OrderDocument>("orders");
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await Task.Yield();
        var config = new ConsumerConfig
        {
            BootstrapServers = _options.KafkaBootstrapServers,
            GroupId = "fulfil-import",
            AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = false
        };
        var done = new Dictionary<TopicPartition, Offset>();
        using var consumer = new ConsumerBuilder<string, string>(config)
            .Build();
        consumer.Subscribe("orders.import");

        var batches = 0;
        try
        {
            while (!ct.IsCancellationRequested)
            {
                var batch = new List<ConsumeResult<string, string>>(BatchSize);
                while (batch.Count < BatchSize && consumer.Consume(TimeSpan.FromSeconds(1)) is { } r)
                    batch.Add(r);
                if (batch.Count == 0) continue;

                try
                {
                    await WriteBatchAsync(batch, ct);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogError("Пачка импорта не записана: {Error}", ex.GetType().Name);
                }
                finally
                {
                    foreach (var g in batch.GroupBy(x => x.TopicPartition))
                        done[g.Key] = g.Max(x => x.Offset.Value) + 1;
                }
                if (++batches % CommitEveryBatches == 0)
                    consumer.Commit(done.Select(kv => new TopicPartitionOffset(kv.Key, kv.Value)));
            }
        }
        catch (OperationCanceledException)
        {
        }
        finally
        {
            if (done.Count > 0) consumer.Commit(done.Select(kv => new TopicPartitionOffset(kv.Key, kv.Value)));
            consumer.Close();
        }
    }

    private async Task WriteBatchAsync(List<ConsumeResult<string, string>> batch, CancellationToken ct)
    {
        var docs = batch.Select(r => OrderDocument.From(JsonSerializer.Deserialize<OrderPlaced>(r.Message.Value, KafkaJson.Options)!)).ToList();
        try
        {
            await _orders.InsertManyAsync(docs, new InsertManyOptions { IsOrdered = false }, ct);
        }
        catch (MongoBulkWriteException<OrderDocument> ex) when (ex.WriteErrors.All(e => e.Category == ServerErrorCategory.DuplicateKey))
        {
        }
    }
}
