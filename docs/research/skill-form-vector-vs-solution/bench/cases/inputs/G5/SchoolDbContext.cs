using Microsoft.EntityFrameworkCore;

namespace AutoSchool.Cloud;

// Автошкола текущего запроса; заполняется в Program.cs по заголовку от шлюза (поддомен школы).
public class CurrentSchool
{
    public int Id { get; set; }
}

public class SchoolDbContext : DbContext
{
    private readonly CurrentSchool _school;

    public SchoolDbContext(DbContextOptions<SchoolDbContext> options, CurrentSchool school)
        : base(options) => _school = school;

    public int SchoolId => _school.Id;

    public DbSet<School> Schools => Set<School>();
    public DbSet<Instructor> Instructors => Set<Instructor>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<DrivingLesson> Lessons => Set<DrivingLesson>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Instructor>().Property(i => i.FullName).HasMaxLength(200);

        b.Entity<Student>(e =>
        {
            e.HasIndex(s => new { s.SchoolId, s.Email }).IsUnique();
            e.Property(s => s.Email).HasMaxLength(200);
            e.Property(s => s.PassportNo).HasMaxLength(20);
            e.Property(s => s.Status).HasConversion<string>().HasMaxLength(16);
        });

        b.Entity<DrivingLesson>(e =>
        {
            e.HasIndex(l => new { l.StudentId, l.StartsAt });
            e.HasOne(l => l.Instructor).WithMany().OnDelete(DeleteBehavior.Restrict);
        });

        b.ApplyQueryFilters(this);
    }

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        foreach (var entry in ChangeTracker.Entries<ISchoolOwned>()
                     .Where(e => e.State == EntityState.Added))
        {
            entry.Entity.SchoolId = _school.Id;
        }

        return base.SaveChangesAsync(ct);
    }
}
