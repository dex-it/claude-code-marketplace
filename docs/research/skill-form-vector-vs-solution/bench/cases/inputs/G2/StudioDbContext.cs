using Microsoft.EntityFrameworkCore;

namespace FlowStudio.Schedule;

public class StudioDbContext : DbContext
{
    public StudioDbContext(DbContextOptions<StudioDbContext> options) : base(options) { }

    public DbSet<Hall> Halls => Set<Hall>();
    public DbSet<Trainer> Trainers => Set<Trainer>();
    public DbSet<Member> Members => Set<Member>();
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<Enrollment> Enrollments => Set<Enrollment>();
    public DbSet<TurnstilePass> TurnstilePasses => Set<TurnstilePass>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Member>(e =>
        {
            e.HasIndex(m => m.CardNumber).IsUnique();
            e.Property(m => m.Phone).HasMaxLength(20);
        });

        b.Entity<Session>().HasIndex(s => s.StartsAt);

        b.Entity<Enrollment>(e =>
        {
            e.HasIndex(x => new { x.SessionId, x.MemberId }).IsUnique();
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
        });

        b.Entity<TurnstilePass>(e =>
        {
            e.HasIndex(p => p.ProcessedAt);
            e.Property(p => p.CardNumber).HasMaxLength(32);
        });
    }
}
