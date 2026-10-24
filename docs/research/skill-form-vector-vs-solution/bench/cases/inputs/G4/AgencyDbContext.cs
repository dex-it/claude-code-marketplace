using Microsoft.EntityFrameworkCore;

namespace Pixelwork.Timesheets;

public class AgencyDbContext : DbContext
{
    public AgencyDbContext(DbContextOptions<AgencyDbContext> options) : base(options) { }

    public DbSet<Client> Clients => Set<Client>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<TimeEntry> TimeEntries => Set<TimeEntry>();
    public DbSet<ClosedPeriod> ClosedPeriods => Set<ClosedPeriod>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Client>().HasQueryFilter(c => !c.IsDeleted);

        b.Entity<Project>(e =>
        {
            e.HasQueryFilter(p => !p.IsDeleted);
            e.Property(p => p.Code).HasMaxLength(32);
            e.Property(p => p.HourlyRate).HasPrecision(10, 2);
            e.HasIndex(p => p.Code);

            e.HasMany(p => p.Entries)
                .WithOne(t => t.Project)
                .HasForeignKey(t => t.ProjectId);
        });

        b.Entity<TimeEntry>(e =>
        {
            e.Property(t => t.Hours).HasPrecision(5, 2);
            e.HasIndex(t => new { t.ProjectId, t.WorkDate });
            e.HasIndex(t => new { t.EmployeeId, t.WorkDate });
        });

        b.Entity<ClosedPeriod>(e =>
        {
            e.Property(p => p.Month)
                .HasConversion(m => m.Key, key => YearMonth.FromKey(key))
                .HasColumnName("Month");
            e.HasIndex(p => p.Month).IsUnique();
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        foreach (var entry in ChangeTracker.Entries<ISoftDeletable>()
                     .Where(e => e.State == EntityState.Deleted))
        {
            entry.State = EntityState.Modified;
            entry.Entity.IsDeleted = true;
            entry.Entity.DeletedAt = DateTime.UtcNow;
        }

        return base.SaveChangesAsync(ct);
    }
}
