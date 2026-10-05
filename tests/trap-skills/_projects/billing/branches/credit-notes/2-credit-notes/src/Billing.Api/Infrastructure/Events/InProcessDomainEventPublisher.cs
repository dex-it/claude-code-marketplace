using Billing.Api.Application.Abstractions;

namespace Billing.Api.Infrastructure.Events;

public sealed class InProcessDomainEventPublisher(IServiceProvider services) : IDomainEventPublisher
{
    public async Task PublishAsync<T>(T domainEvent, CancellationToken ct) where T : notnull
    {
        foreach (var handler in services.GetServices<IDomainEventHandler<T>>())
            await handler.HandleAsync(domainEvent, ct);
    }
}
