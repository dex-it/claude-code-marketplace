namespace OrdersApi.Orders;

public record CreateOrderRequest(Guid CustomerId, string Channel, List<OrderLine> Lines);
public record OrderLine(string Sku, int Qty, decimal Price);
public record Order(Guid Id, Guid CustomerId, string Channel, string Status, decimal Total, DateTime CreatedAt);

public class OrderService(IOrderRepository repo, ILogger<OrderService> log)
{
    public async Task<Order> CreateAsync(CreateOrderRequest r, CancellationToken ct)
    {
        if (r.Lines.Count == 0) throw new ArgumentException("empty order");
        var total = r.Lines.Sum(l => l.Qty * l.Price);
        var order = new Order(Guid.NewGuid(), r.CustomerId, r.Channel, "new", total, DateTime.UtcNow);
        await repo.SaveAsync(order, ct);
        log.LogInformation("Order {OrderId} created, total {Total}", order.Id, total);
        return order;
    }
}
