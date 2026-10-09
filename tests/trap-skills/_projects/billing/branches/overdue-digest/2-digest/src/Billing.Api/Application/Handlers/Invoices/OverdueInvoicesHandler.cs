using Billing.Api.Application.Validation;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Persistence;
using FluentValidation;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record OverdueInvoicesQuery(DateOnly AsOf, int Limit);

public sealed class OverdueInvoicesValidator : BillingValidator<OverdueInvoicesQuery>
{
    public const int MaxLimit = 500;

    public OverdueInvoicesValidator() => RuleFor(x => x.Limit).InclusiveBetween(1, MaxLimit);
}

public sealed class OverdueInvoicesHandler(InMemoryStore store, OverdueInvoicesValidator validator)
{
    public Task<Result<IReadOnlyList<Invoice>>> HandleAsync(OverdueInvoicesQuery query, CancellationToken ct)
    {
        if (validator.Check(query) is { } error)
            return Task.FromResult<Result<IReadOnlyList<Invoice>>>(error);

        var overdue = store.Invoices.Values
            .Where(i => i.DueDate < query.AsOf && i.PaidAt is null)
            .OrderBy(i => i.DueDate)
            .Take(query.Limit)
            .ToList();
        return Task.FromResult<Result<IReadOnlyList<Invoice>>>(overdue);
    }
}
