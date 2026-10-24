namespace Billing.Api.Application.Abstractions;

public interface IOutbox
{
    Task EnqueueAsync<T>(T message, CancellationToken ct) where T : notnull;
}
