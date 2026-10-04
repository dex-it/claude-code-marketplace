namespace AutoSchool.Cloud;

public interface ISchoolOwned
{
    int SchoolId { get; set; }
}

public enum StudentStatus { Learning, Graduated, Expelled }

public class School
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
}

public class Instructor : ISchoolOwned
{
    public int Id { get; set; }
    public int SchoolId { get; set; }
    public string FullName { get; set; } = "";
    public string Phone { get; set; } = "";
    // Уволенный инструктор: не показывается в расписании и списках автошколы.
    public bool IsDeleted { get; set; }
    public DateOnly? DismissedOn { get; set; }
}

public class Student : ISchoolOwned
{
    public int Id { get; set; }
    public int SchoolId { get; set; }
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public string PassportNo { get; set; } = "";
    public StudentStatus Status { get; set; }
    public int? InstructorId { get; set; }
    public Instructor? Instructor { get; set; }
    public DateOnly? GraduatedOn { get; set; }

    // Вид карточки для инструктора: паспорт и почта скрыты.
    public Student MaskForInstructor()
    {
        PassportNo = PassportNo.Length > 4
            ? new string('*', PassportNo.Length - 4) + PassportNo[^4..]
            : "****";

        var at = Email.IndexOf('@');
        Email = at > 1 ? Email[0] + "***" + Email[at..] : "***";
        return this;
    }
}

public class DrivingLesson : ISchoolOwned
{
    public int Id { get; set; }
    public int SchoolId { get; set; }
    public int StudentId { get; set; }
    public Student Student { get; set; } = null!;
    public int InstructorId { get; set; }
    public Instructor Instructor { get; set; } = null!;
    public DateTime StartsAt { get; set; }      // UTC
    public int Minutes { get; set; }
    public bool Done { get; set; }
}
