using System.Collections.Concurrent;
using Pricing.Application.Abstractions;
using Pricing.Application.Promotions;

namespace Pricing.Application.Quotes;

public interface IPricingSources
{
    IProductRepository Products { get; }
    ISupplierCatalog Suppliers { get; }
    IPromotionRepository Promotions { get; }
}

public interface IB2BNotifier
{
    Task QuoteReadyAsync(string customerId, Guid requestId, CancellationToken ct);
}

public sealed class QuoteBatchService(IPricingSources sources, IB2BNotifier notifier)
{
    private readonly ConcurrentDictionary<Guid, Quote> _done = new();

    public Guid Start(string customerId, IReadOnlyList<QuoteLine> lines)
    {
        var requestId = Guid.NewGuid();
        _ = Task.Run(async () =>
        {
            var quotes = new QuoteService(sources.Products, sources.Suppliers, new PromotionService(sources.Promotions));
            _done[requestId] = await quotes.QuoteAsync(lines, CancellationToken.None);
            await notifier.QuoteReadyAsync(customerId, requestId, CancellationToken.None);
        });
        return requestId;
    }

    public Quote? TryGet(Guid requestId) => _done.GetValueOrDefault(requestId);
}
