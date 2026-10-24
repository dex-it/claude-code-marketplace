using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace OrdersApi.Orders;

public record CreateOrderRequest(Guid CustomerId, string Channel, List<OrderLine> Lines);
public record OrderLine(string Sku, int Qty, decimal Price);
public record Order(Guid Id, Guid CustomerId, string Channel, string Status, decimal Total, DateTime CreatedAt);

public class OrderService(IOrderRepository repo, PaymentClient payments, ILogger<OrderService> log)
{
    private static readonly ActivitySource Source = new("Orders");
    private static readonly Meter AppMeter = new("Orders");
    private static readonly Counter<long> Created = AppMeter.CreateCounter<long>("orders_created");
    private static readonly Histogram<double> Duration = AppMeter.CreateHistogram<double>("order_duration");
    private static long _createdTotal;
    private static readonly ObservableGauge<long> CreatedGauge = AppMeter.CreateObservableGauge("orders_created_total", () => _createdTotal);

    public async Task<Order> CreateAsync(CreateOrderRequest r, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        using (Source.StartActivity("Validate"))
        {
            if (r.Lines.Count == 0) throw new ArgumentException("empty order");
        }
        Order order;
        using (Source.StartActivity("Map"))
        {
            var total = r.Lines.Sum(l => l.Qty * l.Price);
            order = new Order(Guid.NewGuid(), r.CustomerId, r.Channel, "new", total, DateTime.UtcNow);
        }
        using (var save = Source.StartActivity("Save"))
        {
            save?.SetTag("order.id", order.Id);
            try { await repo.SaveAsync(order, ct); }
            catch (Exception ex)
            {
                log.LogError(ex, "Order save failed");
                throw;
            }
        }
        using (var pay = Source.StartActivity("payments.authorize"))
        {
            await payments.AuthorizeAsync(order.Id, order.Total, ct);
        }
        Created.Add(1, new("customer_id", r.CustomerId), new("channel", r.Channel));
        Interlocked.Increment(ref _createdTotal);
        Duration.Record(sw.Elapsed.TotalMilliseconds);
        log.LogInformation("Order {OrderId} created, total {Total}", order.Id, order.Total);
        return order;
    }

    public async Task RefundAsync(Guid id, CancellationToken ct)
    {
        var source = new ActivitySource("Orders.Refund");
        var meter = new Meter("Orders.Refund");
        using var a = source.StartActivity("Refund");
        meter.CreateCounter<long>("orders_refunded").Add(1);
        await repo.MarkRefundedAsync(id, ct);
    }
}

public class PaymentClient(HttpClient http)
{
    public Task AuthorizeAsync(Guid orderId, decimal amount, CancellationToken ct) =>
        http.PostAsJsonAsync("/authorize", new { orderId, amount }, ct);
}
