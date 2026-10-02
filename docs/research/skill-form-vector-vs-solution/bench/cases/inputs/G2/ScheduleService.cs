using Microsoft.EntityFrameworkCore;

namespace FlowStudio.Schedule;

public record CourseDto(int Id, string Title, string Trainer, CourseStatus Status,
    IReadOnlyList<SessionDto> Sessions);

public record SessionDto(int Id, DateTime StartsAt, int DurationMinutes, string Hall, int Booked);

public class ScheduleService
{
    private readonly StudioDbContext _db;

    public ScheduleService(StudioDbContext db) => _db = db;

    public async Task<CourseDto?> GetCourseAsync(int id)
    {
        var course = await _db.Courses
            .AsNoTracking()
            .Include(c => c.Trainer)
            .Include(c => c.Sessions).ThenInclude(s => s.Hall)
            .Include(c => c.Sessions).ThenInclude(s => s.Enrollments)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (course is null)
            return null;

        return new CourseDto(course.Id, course.Title, course.Trainer.FullName, course.Status,
            course.Sessions
                .OrderBy(s => s.StartsAt)
                .Select(s => new SessionDto(s.Id, s.StartsAt, s.DurationMinutes, s.Hall.Name,
                    s.Enrollments.Count(e => e.Status != EnrollmentStatus.Cancelled)))
                .ToList());
    }

    public async Task PublishAsync(int courseId)
    {
        var course = await _db.Courses.FirstOrDefaultAsync(c => c.Id == courseId)
            ?? throw new KeyNotFoundException();
        if (course.Status != CourseStatus.Draft)
            throw new InvalidOperationException("Опубликовать можно только черновик");

        course.Status = CourseStatus.Published;
        await _db.SaveChangesAsync();
    }

    public async Task<int> EnrollAsync(string cardNumber, int sessionId)
    {
        var member = await _db.Members.SingleOrDefaultAsync(m => m.CardNumber == cardNumber)
            ?? throw new KeyNotFoundException("Карта не найдена");

        var session = await _db.Sessions
            .Include(s => s.Course)
            .Include(s => s.Hall)
            .FirstOrDefaultAsync(s => s.Id == sessionId)
            ?? throw new KeyNotFoundException("Занятие не найдено");

        if (session.Course.Status != CourseStatus.Published)
            throw new InvalidOperationException("Запись на курс не открыта");

        var booked = await _db.Enrollments.CountAsync(e =>
            e.SessionId == sessionId && e.Status != EnrollmentStatus.Cancelled);
        if (booked >= session.Hall.Capacity)
            throw new InvalidOperationException("Мест нет");

        var enrollment = new Enrollment
        {
            SessionId = session.Id,
            MemberId = member.Id,
            Status = EnrollmentStatus.Booked,
        };
        _db.Enrollments.Add(enrollment);
        await _db.SaveChangesAsync();
        return enrollment.Id;
    }

    public async Task CancelEnrollmentAsync(int enrollmentId)
    {
        var enrollment = await _db.Enrollments.FindAsync(enrollmentId)
            ?? throw new KeyNotFoundException();
        enrollment.Status = EnrollmentStatus.Cancelled;
        await _db.SaveChangesAsync();
    }
}
