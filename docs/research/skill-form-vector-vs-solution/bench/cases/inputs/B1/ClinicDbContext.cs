using Microsoft.EntityFrameworkCore;
using VetClinic.Reception.Domain;

namespace VetClinic.Reception.Data;

public class ClinicDbContext(DbContextOptions<ClinicDbContext> options) : DbContext(options)
{
    public DbSet<Owner> Owners => Set<Owner>();
    public DbSet<Pet> Pets => Set<Pet>();
    public DbSet<Vaccination> Vaccinations => Set<Vaccination>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Owner>(e =>
        {
            e.Property(o => o.FullName).HasMaxLength(200);
            e.Property(o => o.Phone).HasMaxLength(11);
            e.Property(o => o.Email).HasMaxLength(200);
            e.Property(o => o.CreatedAt).HasDefaultValueSql("now()");
            e.HasIndex(o => o.Email).IsUnique();
            e.HasIndex(o => o.Phone);   // не уникальный, см. комментарий к Owner.Phone
        });

        b.Entity<Pet>(e =>
        {
            e.Property(p => p.Name).HasMaxLength(100);
            e.HasOne(p => p.Owner).WithMany(o => o.Pets).HasForeignKey(p => p.OwnerId);
            e.HasIndex(p => new { p.Species, p.BirthDate });
        });

        b.Entity<Vaccination>(e =>
        {
            e.Property(v => v.VaccineCode).HasMaxLength(20);
            e.HasOne(v => v.Pet).WithMany(p => p.Vaccinations).HasForeignKey(v => v.PetId);
            e.HasIndex(v => new { v.PetId, v.VaccineCode, v.AdministeredAt });
        });
    }
}
