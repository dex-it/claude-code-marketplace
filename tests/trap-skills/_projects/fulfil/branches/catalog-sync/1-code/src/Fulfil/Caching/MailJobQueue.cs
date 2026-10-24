using System.Text.Json;
using StackExchange.Redis;

namespace Fulfil.Caching;

public sealed record MailJob(string Template, string To);

public interface IMailSender
{
    Task SendAsync(MailJob job, CancellationToken ct);
}

public sealed class LogMailSender(ILogger<LogMailSender> log) : IMailSender
{
    public Task SendAsync(MailJob job, CancellationToken ct)
    {
        log.LogInformation("Mail {Template} sent", job.Template);
        return Task.CompletedTask;
    }
}

public sealed class MailJobQueue(IConnectionMultiplexer redis)
{
    public const string Stream = "mail:jobs";
    public const string Group = "mail-workers";

    public Task EnqueueAsync(MailJob job) =>
        redis.GetDatabase().StreamAddAsync(
            Stream,
            new[] { new NameValueEntry("job", JsonSerializer.Serialize(job)) },
            maxLength: 100_000,
            useApproximateMaxLength: true);
}

public sealed class MailWorker(IConnectionMultiplexer redis, IMailSender sender, ILogger<MailWorker> log)
    : BackgroundService
{
    readonly string _consumer = Environment.MachineName;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        var db = redis.GetDatabase();
        try
        {
            await db.StreamCreateConsumerGroupAsync(MailJobQueue.Stream, MailJobQueue.Group, "0");
        }
        catch (RedisServerException ex) when (ex.Message.StartsWith("BUSYGROUP"))
        {
        }

        while (!ct.IsCancellationRequested)
        {
            var claimed = await db.StreamAutoClaimAsync(
                MailJobQueue.Stream, MailJobQueue.Group, _consumer, 60_000, "0-0", count: 10);
            var fresh = await db.StreamReadGroupAsync(
                MailJobQueue.Stream, MailJobQueue.Group, _consumer, ">", count: 10);

            var entries = claimed.ClaimedEntries.Concat(fresh).ToArray();
            foreach (var entry in entries)
                await HandleAsync(db, entry, ct);
            if (entries.Length == 0)
                await Task.Delay(TimeSpan.FromSeconds(1), ct);
        }
    }

    async Task HandleAsync(IDatabase db, StreamEntry entry, CancellationToken ct)
    {
        try
        {
            var job = JsonSerializer.Deserialize<MailJob>(entry["job"].ToString())!;
            await sender.SendAsync(job, ct);
            await db.StreamAcknowledgeAsync(MailJobQueue.Stream, MailJobQueue.Group, entry.Id);
            await db.StreamDeleteAsync(MailJobQueue.Stream, new[] { entry.Id });
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            log.LogError(ex, "Mail job {EntryId} failed", entry.Id);
        }
    }
}
