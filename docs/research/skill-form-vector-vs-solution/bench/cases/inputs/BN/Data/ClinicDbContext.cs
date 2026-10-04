using Microsoft.EntityFrameworkCore;
using VetClinic.Procedures.Domain;

namespace VetClinic.Procedures.Data;

public class ClinicDbContext(DbContextOptions<ClinicDbContext> options) : DbContext(options)
{
    public DbSet<Pet> Pets => Set<Pet>();
    public DbSet<Procedure> Procedures => Set<Procedure>();
    public DbSet<ConsumableLine> ConsumableLines => Set<ConsumableLine>();
    public DbSet<StaffNote> StaffNotes => Set<StaffNote>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Pet>(e =>
        {
            e.Property(p => p.Name).HasMaxLength(100);
            e.Property(p => p.ChipNumber).HasMaxLength(15);
            e.HasIndex(p => p.ChipNumber).IsUnique();
        });

        b.Entity<Procedure>(e =>
        {
            e.HasOne(p => p.Pet).WithMany().HasForeignKey(p => p.PetId);
            e.Property(p => p.Title).HasMaxLength(200);
            e.Property(p => p.ScheduledLocal).HasColumnType("timestamp without time zone");
            e.HasIndex(p => p.ScheduledLocal);
        });

        b.Entity<ConsumableLine>(e =>
        {
            e.HasOne(c => c.Procedure).WithMany(p => p.Consumables).HasForeignKey(c => c.ProcedureId);
            e.Property(c => c.Item).HasMaxLength(200);
            e.Property(c => c.Quantity).HasPrecision(10, 3);
        });

        b.Entity<StaffNote>(e =>
        {
            e.HasOne(n => n.Procedure).WithMany(p => p.StaffNotes).HasForeignKey(n => n.ProcedureId);
        });
    }
}
