using Microsoft.EntityFrameworkCore;
using VetClinic.Journal.Domain;

namespace VetClinic.Journal.Data;

public class ClinicDbContext(DbContextOptions<ClinicDbContext> options) : DbContext(options)
{
    public DbSet<Pet> Pets => Set<Pet>();
    public DbSet<Vet> Vets => Set<Vet>();
    public DbSet<Visit> Visits => Set<Visit>();
    public DbSet<LabResult> LabResults => Set<LabResult>();
    public DbSet<Prescription> Prescriptions => Set<Prescription>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Visit>(e =>
        {
            e.HasOne(v => v.Pet).WithMany().HasForeignKey(v => v.PetId);
            e.HasOne(v => v.Vet).WithMany().HasForeignKey(v => v.VetId);
            e.HasIndex(v => new { v.PetId, v.SlotStart });
            e.HasIndex(v => new { v.VetId, v.SlotStart });
        });

        b.Entity<LabResult>(e =>
        {
            e.HasOne(r => r.Visit).WithMany(v => v.LabResults).HasForeignKey(r => r.VisitId);
            e.Property(r => r.Value).HasPrecision(12, 4);
        });

        b.Entity<Prescription>(e =>
        {
            e.HasOne(p => p.Visit).WithMany(v => v.Prescriptions).HasForeignKey(p => p.VisitId);
        });
    }
}
