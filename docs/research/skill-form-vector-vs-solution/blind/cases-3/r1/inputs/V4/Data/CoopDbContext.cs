using HoneyCoop.Models;
using Microsoft.EntityFrameworkCore;

namespace HoneyCoop.Data;

public class CoopDbContext : DbContext
{
    public CoopDbContext(DbContextOptions<CoopDbContext> options) : base(options)
    {
    }

    public DbSet<Member> Members => Set<Member>();
    public DbSet<ContainerType> ContainerTypes => Set<ContainerType>();
    public DbSet<PriceListEntry> PriceList => Set<PriceListEntry>();
    public DbSet<Batch> Batches => Set<Batch>();
    public DbSet<Payout> Payouts => Set<Payout>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Member>(e =>
        {
            e.Property(x => x.FullName).HasMaxLength(200);
            e.Property(x => x.BankAccount).HasMaxLength(20);
        });

        modelBuilder.Entity<ContainerType>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(100);
        });

        modelBuilder.Entity<PriceListEntry>(e =>
        {
            e.HasIndex(x => new { x.Grade, x.ValidFrom }).IsUnique();
        });

        modelBuilder.Entity<Batch>(e =>
        {
            e.Property(x => x.TerminalId).HasMaxLength(32);
            e.HasIndex(x => new { x.TerminalId, x.WeighingNo }).IsUnique();
            e.HasIndex(x => new { x.MemberId, x.AcceptedAt });
            e.HasOne(x => x.Payout).WithMany(p => p.Batches).HasForeignKey(x => x.PayoutId);
        });

        modelBuilder.Entity<Payout>(e =>
        {
            e.HasIndex(x => new { x.MemberId, x.Year, x.Month }).IsUnique();
        });
    }
}
