namespace Shop;

public class Customer
{
    public Guid Id { get; set; }
    public string Email { get; set; } = "";
    public string Name { get; set; } = "";
    public List<Order> Orders { get; set; } = new();
}

public class Order
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public string Status { get; set; } = "New";
    public decimal Total { get; set; }
    public List<OrderItem> Items { get; set; } = new();
}

public class OrderItem
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
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
    public List<Review> Reviews { get; set; } = new();
}

public class Review
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public int Score { get; set; }          // 1..5
    public bool Approved { get; set; }
    public string Text { get; set; } = "";
}
