using Microsoft.EntityFrameworkCore;

namespace Tarif.Billing;

public class BillingDbContext : DbContext
{
    public BillingDbContext(DbContextOptions<BillingDbContext> options) : base(options) { }

    public DbSet<Tariff> Tariffs => Set<Tariff>();
    public DbSet<Subscriber> Subscribers => Set<Subscriber>();
    public DbSet<Payment> Payments => Set<Payment>();

    protected override void ConfigureConventions(ModelConfigurationBuilder b)
    {
        b.Properties<DateTime>().HaveColumnType("timestamp without time zone");
        b.Properties<decimal>().HavePrecision(12, 2);
        b.Properties<string>().HaveMaxLength(500);
    }

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Subscriber>(e =>
        {
            e.HasIndex(s => s.ContractNo).IsUnique();
            e.HasIndex(s => s.Phone);
            e.Property(s => s.ContractNo).HasMaxLength(16);
            e.Property(s => s.Phone).HasMaxLength(20);
            e.Property(s => s.Status).HasConversion<string>().HasMaxLength(16);
        });

        b.Entity<Payment>(e =>
        {
            e.HasIndex(p => p.BankRef).IsUnique();
            e.Property(p => p.BankRef).HasMaxLength(64);
        });
    }
}
