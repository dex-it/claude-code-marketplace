using Microsoft.EntityFrameworkCore;

namespace Aqualab.Samples;

public class LabDbContext : DbContext
{
    public LabDbContext(DbContextOptions<LabDbContext> options) : base(options) { }

    public DbSet<Site> Sites => Set<Site>();
    public DbSet<Sample> Samples => Set<Sample>();
    public DbSet<Result> Results => Set<Result>();
    public DbSet<Batch> Batches => Set<Batch>();

    protected override void OnConfiguring(DbContextOptionsBuilder o) =>
        o.UseSnakeCaseNamingConvention();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Site>().HasIndex(s => s.Code).IsUnique();

        b.Entity<Sample>(e =>
        {
            e.HasIndex(s => s.LabCode).IsUnique();
            e.Property(s => s.Status).HasConversion<string>().HasMaxLength(16);
            e.Property(s => s.PlannedLocal).HasColumnType("timestamp without time zone");

            e.HasMany(s => s.Tags).WithOne().HasForeignKey(t => t.SampleId);
            e.HasMany(s => s.Results).WithOne().HasForeignKey(r => r.SampleId);
        });

        b.Entity<SampleTag>().Property(t => t.Tag).HasMaxLength(40);

        b.Entity<Result>(e =>
        {
            e.Property(r => r.Value).HasPrecision(12, 4);
            e.Property(r => r.Limit).HasPrecision(12, 4);
        });

        b.Entity<Batch>(e =>
        {
            e.HasIndex(x => x.Number).IsUnique();
            e.HasMany(x => x.Instruments).WithOne().HasForeignKey(i => i.BatchId);
        });
    }
}
