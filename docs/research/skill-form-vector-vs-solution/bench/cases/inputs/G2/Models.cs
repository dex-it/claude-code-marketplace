namespace FlowStudio.Schedule;

public enum CourseStatus { Draft, Published, Archived }
public enum EnrollmentStatus { Booked, Attended, Cancelled }

public class Hall
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int Capacity { get; set; }
}

public class Trainer
{
    public int Id { get; set; }
    public string FullName { get; set; } = "";
}

public class Member
{
    public int Id { get; set; }
    public string CardNumber { get; set; } = "";
    public string FullName { get; set; } = "";
    public string Phone { get; set; } = "";
}

public class Course
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public int TrainerId { get; set; }
    public Trainer Trainer { get; set; } = null!;
    public CourseStatus Status { get; set; }
    public List<Session> Sessions { get; set; } = new();
}

public class Session
{
    public int Id { get; set; }
    public int CourseId { get; set; }
    public Course Course { get; set; } = null!;
    public int HallId { get; set; }
    public Hall Hall { get; set; } = null!;
    public DateTime StartsAt { get; set; }       // UTC
    public int DurationMinutes { get; set; }
    public List<Enrollment> Enrollments { get; set; } = new();
}

public class Enrollment
{
    public int Id { get; set; }
    public int SessionId { get; set; }
    public Session Session { get; set; } = null!;
    public int MemberId { get; set; }
    public Member Member { get; set; } = null!;
    public EnrollmentStatus Status { get; set; }
    public DateTime? AttendedAt { get; set; }
}

// Проходы через турникет. Строки пишет сервис турникетов (отдельный процесс на ресепшене).
public class TurnstilePass
{
    public long Id { get; set; }
    public string CardNumber { get; set; } = "";
    public DateTime PassedAt { get; set; }       // UTC
    public DateTime? ProcessedAt { get; set; }
    public string? Note { get; set; }
}
