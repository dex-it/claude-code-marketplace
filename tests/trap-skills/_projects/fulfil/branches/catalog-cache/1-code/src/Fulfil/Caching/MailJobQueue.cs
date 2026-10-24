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
    public static readonly RedisChannel Channel = RedisChannel.Literal("mail:jobs");

    public Task EnqueueAsync(MailJob job) =>
        redis.GetSubscriber().PublishAsync(Channel, JsonSerializer.Serialize(job));
}

public sealed class MailWorker(IConnectionMultiplexer redis, IMailSender sender, ILogger<MailWorker> log)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await redis.GetSubscriber().SubscribeAsync(MailJobQueue.Channel, (channel, value) => _ = HandleAsync(value.ToString(), ct));
        await Task.Delay(Timeout.Infinite, ct);
    }

    async Task HandleAsync(string payload, CancellationToken ct)
    {
        try
        {
            var job = JsonSerializer.Deserialize<MailJob>(payload)!;
            await sender.SendAsync(job, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            log.LogError(ex, "Mail job failed");
        }
    }
}
