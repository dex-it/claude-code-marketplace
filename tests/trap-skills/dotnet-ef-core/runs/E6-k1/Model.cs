// Shop.Data - EF Core 8, PostgreSQL (Npgsql.EntityFrameworkCore.PostgreSQL 8)
namespace Shop.Data;

public class Customer { public Guid Id { get; set; } public string Name { get; set; } = ""; public List<Order> Orders { get; set; } = new(); }

public class Order
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public virtual Customer Customer { get; set; } = null!;
    public string Status { get; set; } = "active";
    public string Category { get; set; } = ""; // superseded by Categories/OrderCategories; dropped in a later migration
    public decimal Total { get; set; }
    public DateTime CreatedAt { get; set; }          // column: timestamp without time zone
    public DateTime? ShippedAt { get; set; }
    public bool IsDeleted { get; set; }
    public List<OrderItem> Items { get; set; } = new();
    public List<Payment> Payments { get; set; } = new();
    public List<Category> Categories { get; } = new();
    public List<OrderCategory> OrderCategories { get; } = new();
    public bool IsOverdue(DateTime now) => ShippedAt == null && CreatedAt.AddDays(3) < now;
}

public class Category
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public List<Order> Orders { get; } = new();
    public List<OrderCategory> OrderCategories { get; } = new();
}

// Explicit class (not a hidden join table) so OnDelete is set per side below.
public class OrderCategory
{
    public Guid OrderId { get; set; }
    public Guid CategoryId { get; set; }
    public Order Order { get; set; } = null!;
    public Category Category { get; set; } = null!;
}

public class OrderItem { public int Id { get; set; } public Guid OrderId { get; set; } public Guid ProductId { get; set; } public int Qty { get; set; } }
public class Payment { public int Id { get; set; } public Guid OrderId { get; set; } public decimal Amount { get; set; } }

public class Product
{
    public Guid Id { get; set; }
    public string Sku { get; set; } = "";
    public string Warehouse { get; set; } = "";
    public string Category { get; set; } = "";
    public decimal Price { get; set; }
    public int Stock { get; set; }
}

public class AuditLog { public long Id { get; set; } public DateTime At { get; set; } public string Text { get; set; } = ""; }

public class ShopDbContext : DbContext
{
    public ShopDbContext(DbContextOptions<ShopDbContext> o) : base(o) { }
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Category> Categories => Set<Category>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Order>().HasQueryFilter(o => !o.IsDeleted);
        b.Entity<Order>().Property(o => o.CreatedAt).HasColumnType("timestamp without time zone");

        b.Entity<Category>().HasIndex(c => c.Name).IsUnique();

        b.Entity<Order>()
            .HasMany(o => o.Categories)
            .WithMany(c => c.Orders)
            .UsingEntity<OrderCategory>(
                r => r.HasOne(oc => oc.Category).WithMany(c => c.OrderCategories)
                      .HasForeignKey(oc => oc.CategoryId)
                      .OnDelete(DeleteBehavior.Restrict), // deleting a Category with linked orders must be explicit, not silent
                l => l.HasOne(oc => oc.Order).WithMany(o => o.OrderCategories)
                      .HasForeignKey(oc => oc.OrderId)
                      .OnDelete(DeleteBehavior.ClientCascade), // avoid DB-level cascade on a soft-deleted principal (EF Core docs)
                j => j.ToTable("OrderCategories"));
    }
}
// Options: UseNpgsql(cs).UseLazyLoadingProxies()
