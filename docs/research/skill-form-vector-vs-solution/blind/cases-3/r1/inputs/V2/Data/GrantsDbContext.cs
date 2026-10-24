using GrantDesk.Models;
using Microsoft.EntityFrameworkCore;

namespace GrantDesk.Data;

public class GrantsDbContext : DbContext
{
    public GrantsDbContext(DbContextOptions<GrantsDbContext> options) : base(options)
    {
    }

    public DbSet<Contest> Contests => Set<Contest>();
    public DbSet<Criterion> Criteria => Set<Criterion>();
    public DbSet<GrantApplication> Applications => Set<GrantApplication>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<ReviewScore> ReviewScores => Set<ReviewScore>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Contest>(e =>
        {
            e.Property(x => x.Title).HasMaxLength(300);
        });

        modelBuilder.Entity<Criterion>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200);
        });

        modelBuilder.Entity<GrantApplication>(e =>
        {
            e.ToTable("Applications");
            e.Property(x => x.Title).HasMaxLength(300);
            e.Property(x => x.Region).HasMaxLength(100);
            e.HasIndex(x => new { x.ContestId, x.Status });
        });

        modelBuilder.Entity<Review>(e =>
        {
            e.Property(x => x.Comment).HasMaxLength(4000);
            e.HasIndex(x => new { x.ApplicationId, x.ExpertId }).IsUnique();
            e.HasIndex(x => x.ExpertId);
        });

        modelBuilder.Entity<ReviewScore>(e =>
        {
            e.HasOne<Criterion>().WithMany().HasForeignKey(x => x.CriterionId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
