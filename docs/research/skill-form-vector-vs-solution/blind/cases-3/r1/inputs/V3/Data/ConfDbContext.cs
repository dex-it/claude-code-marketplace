using ConfReg.Models;
using Microsoft.EntityFrameworkCore;

namespace ConfReg.Data;

public class ConfDbContext : DbContext
{
    public ConfDbContext(DbContextOptions<ConfDbContext> options) : base(options)
    {
    }

    public DbSet<Conference> Conferences => Set<Conference>();
    public DbSet<TicketType> TicketTypes => Set<TicketType>();
    public DbSet<PromoCode> PromoCodes => Set<PromoCode>();
    public DbSet<Registration> Registrations => Set<Registration>();
    public DbSet<GroupOrder> GroupOrders => Set<GroupOrder>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TicketType>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(100);
        });

        modelBuilder.Entity<PromoCode>(e =>
        {
            e.Property(x => x.Code).HasMaxLength(32);
            e.HasIndex(x => new { x.ConferenceId, x.Code }).IsUnique();
        });

        modelBuilder.Entity<Registration>(e =>
        {
            e.Property(x => x.FullName).HasMaxLength(200);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.OrganizationId).HasMaxLength(64);
            e.Property(x => x.PassportNumber).HasMaxLength(32);
            e.Property(x => x.PassportCountry).HasMaxLength(2);

            e.HasIndex(x => new { x.ConferenceId, x.UserId })
                .IsUnique()
                .HasFilter("\"Status\" <> 2");

            e.HasIndex(x => new { x.ConferenceId, x.CreatedAt });
        });

        modelBuilder.Entity<GroupOrder>(e =>
        {
            e.Property(x => x.OrganizationId).HasMaxLength(64);
            e.HasIndex(x => new { x.ConferenceId, x.OrganizationId });
        });
    }
}
