using Microsoft.EntityFrameworkCore;
using VetClinic.Records.Domain;

namespace VetClinic.Records.Data;

public class ClinicDbContext(DbContextOptions<ClinicDbContext> options) : DbContext(options)
{
    public DbSet<Owner> Owners => Set<Owner>();
    public DbSet<Pet> Pets => Set<Pet>();
    public DbSet<Allergy> Allergies => Set<Allergy>();
    public DbSet<Visit> Visits => Set<Visit>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Owner>(e =>
        {
            e.HasQueryFilter(o => !o.IsDeleted);
            e.Property(o => o.FullName).HasMaxLength(200);
            e.Property(o => o.Phone).HasMaxLength(11);
        });

        b.Entity<Pet>(e =>
        {
            e.HasQueryFilter(p => !p.IsDeleted);
            e.Property(p => p.Name).HasMaxLength(100);
            e.HasOne(p => p.Owner).WithMany(o => o.Pets).HasForeignKey(p => p.OwnerId);
        });

        b.Entity<Allergy>(e =>
        {
            e.HasQueryFilter(a => !a.IsDeleted);
            e.Property(a => a.Allergen).HasMaxLength(200);
            e.HasOne(a => a.Pet).WithMany(p => p.Allergies).HasForeignKey(a => a.PetId);
        });

        b.Entity<Visit>(e =>
        {
            e.HasQueryFilter(v => !v.IsDeleted);
            e.Property(v => v.VetName).HasMaxLength(200);
            e.HasOne(v => v.Pet).WithMany(p => p.Visits).HasForeignKey(v => v.PetId);
            e.HasIndex(v => new { v.VetName, v.Status, v.ScheduledAt });
        });
    }
}
