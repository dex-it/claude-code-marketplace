using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace Domovoy.Housing;

public class HousingDbContext : DbContext
{
    public HousingDbContext(DbContextOptions<HousingDbContext> options) : base(options)
    {
        // Работы при объединении планов переносятся в другой план вместе с историей
        // выполнения (PlanService.MergePlansAsync).
        ChangeTracker.DeleteOrphansTiming = CascadeTiming.Never;
    }

    public DbSet<House> Houses => Set<House>();
    public DbSet<Apartment> Apartments => Set<Apartment>();
    public DbSet<ServiceRequest> ServiceRequests => Set<ServiceRequest>();
    public DbSet<MaintenancePlan> MaintenancePlans => Set<MaintenancePlan>();
    public DbSet<PlanItem> PlanItems => Set<PlanItem>();
    public DbSet<PlanItemCompletion> PlanItemCompletions => Set<PlanItemCompletion>();

    protected override void OnConfiguring(DbContextOptionsBuilder o) =>
        o.UseSnakeCaseNamingConvention();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<House>().HasIndex(h => h.District);

        b.Entity<Apartment>().HasIndex(a => new { a.HouseId, a.Number }).IsUnique();

        b.Entity<ServiceRequest>(e =>
        {
            e.Property(r => r.Status).HasConversion<string>().HasMaxLength(16);
            e.Property(r => r.Category).HasMaxLength(50);
            e.HasIndex(r => r.CreatedAt);
            // search_vector - generated tsvector-колонка (создана SQL в миграции AddRequestSearch), в модель не входит
        });

        b.Entity<MaintenancePlan>()
            .HasMany(p => p.Items)
            .WithOne(i => i.Plan)
            .HasForeignKey(i => i.PlanId);

        b.Entity<PlanItem>()
            .HasMany(i => i.Completions)
            .WithOne(c => c.PlanItem)
            .HasForeignKey(c => c.PlanItemId);

        b.Entity<PlanItem>().HasIndex(i => new { i.PlanId, i.WorkCode }).IsUnique();
    }
}
