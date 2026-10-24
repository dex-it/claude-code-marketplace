using Pricing.Domain;

namespace Pricing.Application.Abstractions;

public interface IPromotionRepository
{
    Task<IReadOnlyList<Promotion>> ListAsync(CancellationToken ct);
}
