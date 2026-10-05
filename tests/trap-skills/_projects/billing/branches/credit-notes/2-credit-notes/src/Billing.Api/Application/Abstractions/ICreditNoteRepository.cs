using Billing.Api.Domain;

namespace Billing.Api.Application.Abstractions;

public interface ICreditNoteRepository
{
    IQueryable<CreditNote> Query();
    Task<CreditNote?> FindAsync(Guid id, CancellationToken ct);
    Task<int> CountForInvoiceAsync(Guid invoiceId, CancellationToken ct);
    Task<long> IssuedTotalForInvoiceAsync(Guid invoiceId, CancellationToken ct);
    Task<IReadOnlyList<CreditNote>> ListIssuedAsync(CancellationToken ct);
    Task AddAsync(CreditNote note, CancellationToken ct);
}

public interface IDomainEventPublisher
{
    Task PublishAsync<T>(T domainEvent, CancellationToken ct) where T : notnull;
}

public interface IDomainEventHandler<in T>
{
    Task HandleAsync(T domainEvent, CancellationToken ct);
}
