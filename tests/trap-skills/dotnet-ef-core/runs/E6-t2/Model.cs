// Shop.Data - EF Core 8, PostgreSQL (Npgsql.EntityFrameworkCore.PostgreSQL 8)
namespace Shop.Data;

public class Customer { public Guid Id { get; set; } public string Name { get; set; } = ""; public List<Order> Orders { get; set; } = new(); }

public class Order
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public virtual Customer Customer { get; set; } = null!;
    public string Status { get; set; } = "active";
    public string Category { get; set; } = ""; // legacy: снимается отдельной миграцией после переключения читателей на OrderCategories
    public decimal Total { get; set; }
    public DateTime CreatedAt { get; set; }          // column: timestamp without time zone
    public DateTime? ShippedAt { get; set; }
    public bool IsDeleted { get; set; }
    public List<OrderItem> Items { get; set; } = new();
    public List<Payment> Payments { get; set; } = new();
    public List<OrderCategory> OrderCategories { get; set; } = new();
    public bool IsOverdue(DateTime now) => ShippedAt == null && CreatedAt.AddDays(3) < now;
}

public class OrderItem { public int Id { get; set; } public Guid OrderId { get; set; } public Guid ProductId { get; set; } public int Qty { get; set; } }
public class Payment { public int Id { get; set; } public Guid OrderId { get; set; } public decimal Amount { get; set; } }

public class Category
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public List<OrderCategory> OrderCategories { get; set; } = new();
}

public class OrderCategory
{
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public Guid CategoryId { get; set; }
    public Category Category { get; set; } = null!;
}

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
    public DbSet<OrderCategory> OrderCategories => Set<OrderCategory>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Order>().HasQueryFilter(o => !o.IsDeleted);
        b.Entity<Order>().Property(o => o.CreatedAt).HasColumnType("timestamp without time zone");

        b.Entity<Category>(c =>
        {
            c.Property(x => x.Name).HasMaxLength(200).IsRequired();
            c.HasIndex(x => x.Name).IsUnique();
        });

        b.Entity<OrderCategory>(oc =>
        {
            oc.HasKey(x => new { x.OrderId, x.CategoryId });

            // Cascade: строка связи не нужна без заказа - совпадает с дефолтом EF, зафиксирован явно.
            oc.HasOne(x => x.Order)
              .WithMany(o => o.OrderCategories)
              .HasForeignKey(x => x.OrderId)
              .OnDelete(DeleteBehavior.Cascade);

            // Restrict: удаление category с активными ссылками падает ошибкой, не рвёт связи молча.
            oc.HasOne(x => x.Category)
              .WithMany(c => c.OrderCategories)
              .HasForeignKey(x => x.CategoryId)
              .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
// Options: UseNpgsql(cs).UseLazyLoadingProxies()
