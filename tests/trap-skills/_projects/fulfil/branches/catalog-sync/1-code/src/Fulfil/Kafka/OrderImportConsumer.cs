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
            .SetPartitionsRevokedHandler((c, revoked) =>
            {
                var pending = revoked.Where(p => done.ContainsKey(p.TopicPartition))
                    .Select(p => new TopicPartitionOffset(p.TopicPartition, done[p.TopicPartition])).ToList();
                if (pending.Count > 0) c.Commit(pending);
                foreach (var p in revoked) done.Remove(p.TopicPartition);
            })
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
                    foreach (var g in batch.GroupBy(x => x.TopicPartition))
                        consumer.Seek(new TopicPartitionOffset(g.Key, g.Min(x => x.Offset.Value)));
                    await Task.Delay(TimeSpan.FromSeconds(5), ct);
                    continue;
                }

                foreach (var g in batch.GroupBy(x => x.TopicPartition))
                    done[g.Key] = g.Max(x => x.Offset.Value) + 1;
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
        var docs = new List<OrderDocument>(batch.Count);
        foreach (var r in batch)
        {
            try
            {
                if (JsonSerializer.Deserialize<OrderPlaced>(r.Message.Value, KafkaJson.Options) is { } evt)
                    docs.Add(OrderDocument.From(evt));
            }
            catch (JsonException)
            {
                _logger.LogWarning("Пропущено нечитаемое сообщение {Partition}/{Offset}", r.Partition.Value, r.Offset.Value);
            }
        }
        if (docs.Count == 0) return;
        try
        {
            await _orders.InsertManyAsync(docs, new InsertManyOptions { IsOrdered = false }, ct);
        }
        catch (MongoBulkWriteException<OrderDocument> ex) when (ex.WriteErrors.All(e => e.Category == ServerErrorCategory.DuplicateKey))
        {
        }
    }
}
