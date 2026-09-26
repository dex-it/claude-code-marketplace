using Microsoft.EntityFrameworkCore;

namespace Shop.Api.Data;

public class Customer
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
}

public class Order
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public int CustomerId { get; set; }
    public virtual Customer Customer { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public virtual List<OrderLine> Lines { get; set; } = new();
}

public class OrderLine
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public string Sku { get; set; } = "";
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
}

public enum ReturnStatus { Requested, Approved, Rejected, Refunded }

public class ReturnRequest
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public int OrderId { get; set; }
    public virtual Order Order { get; set; } = null!;
    public ReturnStatus Status { get; set; }
    public string Reason { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public string? RefundExternalId { get; set; }
    public virtual List<ReturnLine> Lines { get; set; } = new();
}

public class ReturnLine
{
    public int Id { get; set; }
    public int ReturnRequestId { get; set; }
    public int OrderLineId { get; set; }
    public int Quantity { get; set; }
}

public class ShopDbContext(DbContextOptions<ShopDbContext> options) : DbContext(options)
{
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderLine> OrderLines => Set<OrderLine>();
    public DbSet<ReturnRequest> ReturnRequests => Set<ReturnRequest>();
    public DbSet<ReturnLine> ReturnLines => Set<ReturnLine>();
}
