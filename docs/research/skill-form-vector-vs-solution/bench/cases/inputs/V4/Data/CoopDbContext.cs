using HoneyCoop.Models;
using Microsoft.EntityFrameworkCore;

namespace HoneyCoop.Data;

public class CoopDbContext : DbContext
{
    public CoopDbContext(DbContextOptions<CoopDbContext> options) : base(options)
    {
    }

    public DbSet<Member> Members => Set<Member>();
    public DbSet<HoneyType> HoneyTypes => Set<HoneyType>();
    public DbSet<ContainerType> ContainerTypes => Set<ContainerType>();
    public DbSet<PriceListEntry> PriceList => Set<PriceListEntry>();
    public DbSet<PriceChange> PriceChanges => Set<PriceChange>();
    public DbSet<Batch> Batches => Set<Batch>();
    public DbSet<Payout> Payouts => Set<Payout>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Member>(e =>
        {
            e.Property(x => x.FullName).HasMaxLength(200);
            e.Property(x => x.BankAccount).HasMaxLength(20);
            e.Property(x => x.Bik).HasMaxLength(9);
        });

        modelBuilder.Entity<HoneyType>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(100);
        });

        modelBuilder.Entity<ContainerType>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(100);
        });

        modelBuilder.Entity<PriceListEntry>(e =>
        {
            e.HasIndex(x => new { x.Grade, x.ValidFrom }).IsUnique();
        });

        modelBuilder.Entity<PriceChange>(e =>
        {
            e.Property(x => x.ChangedBy).HasMaxLength(64);
            e.HasOne<PriceListEntry>().WithMany().HasForeignKey(x => x.PriceListEntryId);
        });

        modelBuilder.Entity<Batch>(e =>
        {
            e.Property(x => x.TerminalId).HasMaxLength(32);
            e.HasIndex(x => new { x.TerminalId, x.WeighingNo }).IsUnique();
            e.HasIndex(x => new { x.MemberId, x.AcceptedOn });
            e.HasOne<HoneyType>().WithMany().HasForeignKey(x => x.HoneyTypeId);
            e.HasOne(x => x.Payout).WithMany(p => p.Batches).HasForeignKey(x => x.PayoutId);
        });

        modelBuilder.Entity<Payout>(e =>
        {
            e.Property(x => x.CreatedBy).HasMaxLength(64);
            e.Property(x => x.ApprovedBy).HasMaxLength(64);
            e.Property(x => x.AdjustmentNote).HasMaxLength(500);
            e.Property(x => x.RegistryFile).HasMaxLength(100);
            e.HasIndex(x => new { x.MemberId, x.Year, x.Month }).IsUnique();
            e.HasIndex(x => new { x.Status, x.ExportedAt });
        });
    }
}
