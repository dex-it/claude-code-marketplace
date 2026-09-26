namespace Shop;

public class Customer
{
    public Guid Id { get; set; }
    public string Email { get; set; } = "";
    public string Name { get; set; } = "";
    public bool IsBlocked { get; set; }
    public List<Order> Orders { get; set; } = new();
}

public class Order
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public string Status { get; set; } = "New";   // New, Accepted, Rejected, Confirmed, Paid
    public decimal Total { get; set; }
    public List<OrderItem> Items { get; set; } = new();
}

public class OrderItem
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public Guid ProductId { get; set; }
    public int Qty { get; set; }
    public decimal Price { get; set; }
}

public class Product
{
    public Guid Id { get; set; }
    public string Sku { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Category { get; set; } = "";
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public bool IsActive { get; set; }
    public byte[] Image { get; set; } = Array.Empty<byte>();
}

public class Review
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public int Score { get; set; }
    public bool Approved { get; set; }
    public string Text { get; set; } = "";
}

public class BonusAccount
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public decimal Balance { get; set; }
}

public class Payment
{
    public Guid Id { get; set; }
    public string ExternalId { get; set; } = "";   // id платежа у провайдера
    public Guid OrderId { get; set; }
    public decimal Amount { get; set; }
    public DateTime PaidAt { get; set; }
}

public class Warehouse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public double Lat { get; set; }
    public double Lon { get; set; }
    public bool IsDefault { get; set; }
}

public class StockItem
{
    public Guid Id { get; set; }
    public Guid WarehouseId { get; set; }
    public Guid ProductId { get; set; }
    public int Qty { get; set; }
}

public class Shipment
{
    public Guid Id { get; set; }
    public Guid WarehouseId { get; set; }
    public Guid OrderId { get; set; }
    public DateTime ShippedAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public int? DeliveryDays { get; set; }         // проставляется при доставке
}
