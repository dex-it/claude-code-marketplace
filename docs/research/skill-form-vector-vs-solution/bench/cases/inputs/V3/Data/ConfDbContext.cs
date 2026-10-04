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
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Registration> Registrations => Set<Registration>();
    public DbSet<GroupOrder> GroupOrders => Set<GroupOrder>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Conference>(e =>
        {
            e.Property(x => x.Title).HasMaxLength(300);
        });

        modelBuilder.Entity<TicketType>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(100);
        });

        modelBuilder.Entity<PromoCode>(e =>
        {
            e.Property(x => x.Code).HasMaxLength(32);
            e.HasIndex(x => new { x.ConferenceId, x.Code }).IsUnique();
        });

        modelBuilder.Entity<Organization>(e =>
        {
            e.Property(x => x.Id).HasMaxLength(64);
            e.Property(x => x.Name).HasMaxLength(300);
            e.Property(x => x.Inn).HasMaxLength(12);
            e.Property(x => x.Kpp).HasMaxLength(9);
        });

        modelBuilder.Entity<Registration>(e =>
        {
            e.Property(x => x.UserId).HasMaxLength(64);
            e.Property(x => x.FullName).HasMaxLength(200);
            e.Property(x => x.Email).HasMaxLength(200);
            e.Property(x => x.OrganizationId).HasMaxLength(64);
            e.Property(x => x.PassportNumber).HasMaxLength(32);
            e.Property(x => x.PassportCountry).HasMaxLength(2);

            e.HasIndex(x => new { x.ConferenceId, x.UserId })
                .IsUnique()
                .HasFilter("\"Status\" <> 2");

            e.HasIndex(x => new { x.ConferenceId, x.CreatedAt });
            e.HasIndex(x => new { x.ConferenceId, x.OrganizationId });
        });

        modelBuilder.Entity<GroupOrder>(e =>
        {
            e.Property(x => x.OrganizationId).HasMaxLength(64);
            e.Property(x => x.IdempotencyKey).HasMaxLength(64);
            e.Property(x => x.InvoiceNumber).HasMaxLength(32);
            e.HasIndex(x => new { x.ConferenceId, x.OrganizationId, x.IdempotencyKey }).IsUnique();
            e.HasMany(x => x.Participants).WithOne().HasForeignKey(r => r.GroupOrderId);
        });
    }
}
