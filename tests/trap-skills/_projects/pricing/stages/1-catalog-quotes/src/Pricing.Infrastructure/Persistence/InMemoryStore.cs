using System.Collections.Concurrent;
using Pricing.Domain;

namespace Pricing.Infrastructure.Persistence;

public sealed class InMemoryStore
{
    public ConcurrentDictionary<Guid, Product> Products { get; } = new();
    public ConcurrentDictionary<Guid, Promotion> Promotions { get; } = new();
}
