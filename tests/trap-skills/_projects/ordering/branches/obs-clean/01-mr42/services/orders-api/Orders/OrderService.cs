using System.Diagnostics;
using System.Diagnostics.Metrics;
using OpenTelemetry.Trace;

namespace OrdersApi.Orders;

public record CreateOrderRequest(Guid CustomerId, string Channel, List<OrderLine> Lines);
public record OrderLine(string Sku, int Qty, decimal Price);
public record Order(Guid Id, Guid CustomerId, string Channel, string Status, decimal Total, DateTime CreatedAt);

public class OrderService(IOrderRepository repo, ILogger<OrderService> log)
{
    public const string SourceName = "Orders";
    private static readonly ActivitySource Source = new(SourceName);
    private static readonly Meter AppMeter = new(SourceName);
    private static readonly HashSet<string> Channels = new() { "web", "mobile", "partner" };
    private static readonly Counter<long> Created = AppMeter.CreateCounter<long>("orders_created_total");
    private static readonly Histogram<double> Duration = AppMeter.CreateHistogram<double>("order_create_duration_seconds", unit: "s");

    public async Task<Order> CreateAsync(CreateOrderRequest r, CancellationToken ct)
    {
        var start = Stopwatch.GetTimestamp();
        using var activity = Source.StartActivity("CreateOrder");
        activity?.SetTag("order.customer_id", r.CustomerId);
        activity?.SetTag("order.items_count", r.Lines.Count);
        try
        {
            if (r.Lines.Count == 0) throw new ArgumentException("empty order");
            if (!Channels.Contains(r.Channel)) throw new ArgumentException("unknown channel");
            var total = r.Lines.Sum(l => l.Qty * l.Price);
            var order = new Order(Guid.NewGuid(), r.CustomerId, r.Channel, "new", total, DateTime.UtcNow);
            activity?.SetTag("order.id", order.Id);
            await repo.SaveAsync(order, ct);
            Created.Add(1, new KeyValuePair<string, object?>("channel", r.Channel), new KeyValuePair<string, object?>("status", order.Status));
            log.LogInformation("Order {OrderId} created, total {Total}", order.Id, total);
            return order;
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            activity?.RecordException(ex);
            throw;
        }
        finally
        {
            Duration.Record(Stopwatch.GetElapsedTime(start).TotalSeconds);
        }
    }
}
