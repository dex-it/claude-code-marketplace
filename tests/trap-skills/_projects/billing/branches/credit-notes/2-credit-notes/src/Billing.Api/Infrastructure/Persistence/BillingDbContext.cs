using Billing.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Billing.Api.Infrastructure.Persistence;

public sealed class BillingDbContext(DbContextOptions<BillingDbContext> options) : DbContext(options)
{
    public DbSet<CreditNote> CreditNotes => Set<CreditNote>();
    public DbSet<CreditNoteCounter> CreditNoteCounters => Set<CreditNoteCounter>();
    public DbSet<CreditNoteDocument> CreditNoteDocuments => Set<CreditNoteDocument>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CreditNoteCounter>().HasKey(c => c.Year);
        modelBuilder.Entity<CreditNote>().HasMany(n => n.Lines).WithOne().HasForeignKey(l => l.CreditNoteId);
    }
}
