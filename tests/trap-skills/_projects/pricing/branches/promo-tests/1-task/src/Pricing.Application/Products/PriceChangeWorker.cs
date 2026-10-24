using System.Threading.Channels;
using Pricing.Application.Abstractions;

namespace Pricing.Application.Products;

public sealed record PriceChange(Guid ProductId, decimal NewPrice);

/// <summary>Очередь изменений цены из ERP; обработку ведёт <see cref="PriceChangeWorker"/>.</summary>
public sealed class PriceChangeQueue
{
    private readonly Channel<PriceChange> _channel = Channel.CreateUnbounded<PriceChange>();
    public ValueTask EnqueueAsync(PriceChange change, CancellationToken ct) => _channel.Writer.WriteAsync(change, ct);
    public IAsyncEnumerable<PriceChange> ReadAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}

public sealed class PriceChangeWorker(PriceChangeQueue queue, IProductRepository products)
{
    public event Action<PriceChange, Exception>? Failed;

    public async Task RunAsync(CancellationToken ct)
    {
        await foreach (var change in queue.ReadAllAsync(ct))
        {
            try
            {
                var product = await products.GetAsync(change.ProductId, ct)
                    ?? throw new InvalidOperationException($"Товар {change.ProductId} не найден");
                product.ChangePrice(change.NewPrice);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                Failed?.Invoke(change, ex);
            }
        }
    }
}
