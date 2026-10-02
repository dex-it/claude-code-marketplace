using Microsoft.EntityFrameworkCore;

namespace Motorpool.Fleet;

public class FleetDbContext : DbContext
{
    public FleetDbContext(DbContextOptions<FleetDbContext> options) : base(options) { }

    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<VehicleEquipment> VehicleEquipment => Set<VehicleEquipment>();
    public DbSet<Driver> Drivers => Set<Driver>();
    public DbSet<DriverPermit> DriverPermits => Set<DriverPermit>();
    public DbSet<Inspection> Inspections => Set<Inspection>();
    public DbSet<Trip> Trips => Set<Trip>();

    protected override void OnConfiguring(DbContextOptionsBuilder o) =>
        o.UseSnakeCaseNamingConvention();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Vehicle>(e =>
        {
            e.Property(v => v.PlateNumber).HasMaxLength(12);
            e.Property(v => v.Model).HasMaxLength(40);
            e.Property(v => v.Class).HasConversion<string>().HasMaxLength(10);
            e.HasIndex(v => v.PlateNumber)
                .IsUnique()
                .HasFilter("decommissioned_at IS NULL");
        });

        b.Entity<VehicleEquipment>(e =>
        {
            e.Property(x => x.Code).HasMaxLength(32);
            e.HasIndex(x => new { x.VehicleId, x.Code }).IsUnique();
        });

        b.Entity<Driver>(e =>
        {
            e.HasIndex(d => d.PersonnelNumber).IsUnique();
            e.Property(d => d.DisplayName).HasMaxLength(200);
        });

        b.Entity<DriverPermit>()
            .Property(p => p.Class).HasConversion<string>().HasMaxLength(10);

        b.Entity<Inspection>(e =>
        {
            e.Property(i => i.MechanicName).HasMaxLength(200);
            e.Property(i => i.CreatedAt).HasDefaultValueSql("now()");
            e.HasIndex(i => new { i.VehicleId, i.CreatedAt });
        });

        b.Entity<Trip>(e =>
        {
            e.Property(t => t.Route).HasMaxLength(500);
            e.HasIndex(t => new { t.VehicleId, t.StartedAt });
        });
    }
}
