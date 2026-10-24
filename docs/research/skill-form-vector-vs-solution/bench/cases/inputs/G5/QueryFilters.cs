using Microsoft.EntityFrameworkCore;

namespace AutoSchool.Cloud;

public static class QueryFilters
{
    public static void ApplyQueryFilters(this ModelBuilder b, SchoolDbContext db)
    {
        b.Entity<Instructor>().HasQueryFilter(i => i.SchoolId == db.SchoolId && !i.IsDeleted);
        b.Entity<Student>().HasQueryFilter(s => s.SchoolId == db.SchoolId);
        b.Entity<DrivingLesson>().HasQueryFilter(l => l.SchoolId == db.SchoolId);
    }
}
