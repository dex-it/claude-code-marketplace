using MassTransit;
using MongoDB.Driver;

namespace Fulfil.Payments;

public sealed class OrderSubmittedRelay : BackgroundService
{
    private readonly IMongoCollection<SubmittedOrder> _orders;
    private readonly IBus _bus;
    private readonly ILogger<OrderSubmittedRelay> _logger;

    public OrderSubmittedRelay(IMongoDatabase database, IBus bus, ILogger<OrderSubmittedRelay> logger)
    {
        _orders = database.GetCollection<SubmittedOrder>("orders");
        _bus = bus;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var pending = await _orders.Find(o => o.SubmitPending).Limit(50).ToListAsync(ct);
                foreach (var o in pending)
                {
                    await _bus.Publish(new OrderSubmitted(Guid.Parse(o.Id), o.Total, o.Discount, o.ReceiptEmail,
                        o.Lines), ct);
                    await _orders.UpdateOneAsync(x => x.Id == o.Id, Builders<SubmittedOrder>.Update.Set(x => x.SubmitPending, false), cancellationToken: ct);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError("Публикация OrderSubmitted не удалась: {Error}", ex.GetType().Name);
            }
            await Task.Delay(TimeSpan.FromSeconds(1), ct);
        }
    }
}
