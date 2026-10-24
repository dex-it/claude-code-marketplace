using BerthBook.Models;
using Microsoft.EntityFrameworkCore;

namespace BerthBook.Data;

public class MarinaDbContext : DbContext
{
    public MarinaDbContext(DbContextOptions<MarinaDbContext> options) : base(options)
    {
    }

    public DbSet<Marina> Marinas => Set<Marina>();
    public DbSet<Berth> Berths => Set<Berth>();
    public DbSet<SeasonalRate> SeasonalRates => Set<SeasonalRate>();
    public DbSet<Vessel> Vessels => Set<Vessel>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<Payment> Payments => Set<Payment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Marina>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.TimeZoneId).HasMaxLength(64);
        });

        modelBuilder.Entity<Berth>(e =>
        {
            e.Property(x => x.Code).HasMaxLength(16);
            e.HasIndex(x => new { x.MarinaId, x.Code }).IsUnique();
        });

        modelBuilder.Entity<Vessel>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.RegistrationNumber).HasMaxLength(32);
            e.HasIndex(x => x.OwnerId);
        });

        modelBuilder.Entity<Booking>(e =>
        {
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.ContactPhone).HasMaxLength(32);
            e.HasIndex(x => new { x.BerthId, x.Arrival });
            e.HasIndex(x => x.OwnerId);
        });

        modelBuilder.Entity<Payment>(e =>
        {
            e.Property(x => x.ProviderEventId).HasMaxLength(64);
            e.HasIndex(x => x.BookingId);
        });
    }
}
