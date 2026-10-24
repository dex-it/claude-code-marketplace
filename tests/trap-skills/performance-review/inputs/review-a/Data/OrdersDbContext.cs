using Microsoft.EntityFrameworkCore;

namespace Orders.Api.Data;

public class OrdersDbContext(DbContextOptions<OrdersDbContext> options) : DbContext(options)
{
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderLine> OrderLines => Set<OrderLine>();
}

public class Customer
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public bool AcceptsMarketing { get; set; }
    public string? Notes { get; set; }
    public byte[]? Photo { get; set; }
    public virtual List<Order> Orders { get; set; } = [];
}

public class Order
{
    public int Id { get; set; }
    public string Number { get; set; } = "";
    public int CustomerId { get; set; }
    public virtual Customer Customer { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public string Status { get; set; } = "";
    public decimal Total { get; set; }
    public virtual List<OrderLine> Lines { get; set; } = [];
}

public class OrderLine
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public string ProductSku { get; set; } = "";
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
}
