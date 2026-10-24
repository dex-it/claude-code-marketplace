using Microsoft.EntityFrameworkCore;

namespace Billing.Api.Infrastructure.Reporting;

public sealed class ReportingDbContext : DbContext
{
    public ReportingDbContext(DbContextOptions<ReportingDbContext> options) : base(options)
    {
        Database.EnsureCreated();
    }

    public DbSet<ReportInvoiceRow> Invoices => Set<ReportInvoiceRow>();

    protected override void OnModelCreating(ModelBuilder model) =>
        model.Entity<ReportInvoiceRow>(e =>
        {
            e.ToTable("invoices");
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.CustomerName).HasColumnName("customer_name");
            e.Property(x => x.AmountMinor).HasColumnName("amount_minor");
            e.Property(x => x.Currency).HasColumnName("currency");
            e.Property(x => x.IssuedAt).HasColumnName("issued_at");
        });
}
