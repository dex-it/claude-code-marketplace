using Microsoft.EntityFrameworkCore;
using VetClinic.Hospital.Domain;

namespace VetClinic.Hospital.Data;

public class ClinicDbContext(DbContextOptions<ClinicDbContext> options) : DbContext(options)
{
    public DbSet<Pet> Pets => Set<Pet>();
    public DbSet<Box> Boxes => Set<Box>();
    public DbSet<Stay> Stays => Set<Stay>();
    public DbSet<MedicationOrder> MedicationOrders => Set<MedicationOrder>();
    public DbSet<Observation> Observations => Set<Observation>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Pet>(e =>
        {
            e.Property(p => p.Name).HasMaxLength(100);
            e.Property(p => p.OwnerName).HasMaxLength(200);
        });

        b.Entity<Box>(e =>
        {
            e.Property(x => x.Code).HasMaxLength(10);
            e.Property(x => x.Ward).HasMaxLength(20);
            e.Property(x => x.DailyRate).HasPrecision(10, 2);
            e.HasIndex(x => x.Code).IsUnique();
            // выведенные из эксплуатации боксы не показываем
            e.HasQueryFilter(x => !x.IsDecommissioned);
        });

        b.Entity<Stay>(e =>
        {
            e.HasOne(s => s.Pet).WithMany().HasForeignKey(s => s.PetId);
            e.HasOne(s => s.Box).WithMany(x => x.Stays).HasForeignKey(s => s.BoxId);
            e.Property(s => s.Reason).HasMaxLength(500);
            e.Property(s => s.TotalCost).HasPrecision(10, 2);
            e.HasIndex(s => new { s.PetId, s.AdmittedOn });
            e.HasIndex(s => new { s.BoxId, s.DischargedOn });
        });

        b.Entity<MedicationOrder>(e =>
        {
            // госпитализацию с назначениями удалить нельзя
            e.HasOne(m => m.Stay).WithMany(s => s.MedicationOrders).HasForeignKey(m => m.StayId)
                .OnDelete(DeleteBehavior.Restrict);
            e.Property(m => m.Drug).HasMaxLength(200);
            e.Property(m => m.DoseMg).HasPrecision(10, 3);
        });

        b.Entity<Observation>(e =>
        {
            e.HasOne(o => o.Stay).WithMany(s => s.Observations).HasForeignKey(o => o.StayId);
            e.Property(o => o.TemperatureC).HasPrecision(4, 1);
        });
    }
}
