using Npgsql;

namespace OrdersApi.Outbox;

public class OutboxDispatcher(IOutboxQueue queue, IHttpClientFactory http, IConfiguration cfg, ILogger<OutboxDispatcher> log) : BackgroundService
{
    private static readonly Dictionary<Guid, int> Attempts = new();
    private static int _published;
    private static readonly object CounterLock = new();
    private readonly List<OutboxMessage> _batch = new();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var taken = await queue.TakeBatchAsync(50, stoppingToken);
            lock (_batch)
            {
                _batch.AddRange(taken);
                foreach (var m in _batch) PublishWithRetryAsync(m).GetAwaiter().GetResult();
                _batch.Clear();
            }
            await Task.Delay(1000);
        }
    }

    private async Task PublishWithRetryAsync(OutboxMessage m)
    {
        var client = http.CreateClient("payments");
        for (var i = 0; i < 3; i++)
        {
            try
            {
                Attempts[m.Id] = Attempts.GetValueOrDefault(m.Id) + 1;
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
                var resp = await client.PostAsJsonAsync("/payments/create", new { m.Id, m.Payload }, cts.Token);
                resp.EnsureSuccessStatusCode();
                lock (CounterLock) _published++;
                await MarkSentAsync(m.Id, DateTime.UtcNow);
                return;
            }
            catch (Exception ex)
            {
                await using var c = new NpgsqlConnection(cfg.GetConnectionString("Orders"));
                await c.OpenAsync();
                await new NpgsqlCommand($"insert into outbox_errors(id, error) values ('{m.Id}', '{ex.Message}')", c).ExecuteNonQueryAsync();
                log.LogWarning("Publish failed {Id} at {At}", m.Id, DateTime.UtcNow);
            }
        }
    }

    private async Task MarkSentAsync(Guid id, DateTime sentAt)
    {
        await using var c = new NpgsqlConnection(cfg.GetConnectionString("Orders"));
        await c.OpenAsync();
        await new NpgsqlCommand($"update outbox set sent_at='{sentAt:O}', locked_until=null where id='{id}' and (locked_until is null or locked_until < now())", c).ExecuteNonQueryAsync();
    }
}
