using Npgsql;

namespace OrdersApi.Outbox;

public class OutboxDispatcher(IOutboxQueue queue, IHttpClientFactory http, IConfiguration cfg, ILogger<OutboxDispatcher> log) : BackgroundService
{
    private int _published;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            IReadOnlyList<OutboxMessage> batch;
            try { batch = await queue.TakeBatchAsync(50, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex)
            {
                log.LogError(ex, "Take batch failed");
                try { await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken); } catch (OperationCanceledException) { return; }
                continue;
            }
            foreach (var m in batch)
            {
                try { await PublishAsync(m, stoppingToken); }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
                catch (Exception ex) { log.LogWarning(ex, "Publish failed {Id}", m.Id); }
            }
            try { await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken); } catch (OperationCanceledException) { return; }
        }
    }

    private async Task PublishAsync(OutboxMessage m, CancellationToken ct)
    {
        var client = http.CreateClient("payments");
        using var req = new HttpRequestMessage(HttpMethod.Post, "/payments/create") { Content = JsonContent.Create(new { m.Id, m.Payload }) };
        req.Headers.Add("Idempotency-Key", m.Id.ToString());
        using var resp = await client.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
        Interlocked.Increment(ref _published);
        await using var c = new NpgsqlConnection(cfg.GetConnectionString("Orders"));
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("update outbox set sent_at = now(), locked_until = null where id=@id", c);
        cmd.Parameters.AddWithValue("id", m.Id);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
