using Pricing.Application.Abstractions;
using Pricing.Domain;

namespace Pricing.Infrastructure.Persistence;

public sealed class InMemoryPromotionRepository(InMemoryStore store) : IPromotionRepository
{
    public Task<IReadOnlyList<Promotion>> ListAsync(CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<Promotion>>(store.Promotions.Values.ToList());
}
