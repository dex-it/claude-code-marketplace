using System.Text;
using Microsoft.EntityFrameworkCore;

namespace AutoSchool.Cloud;

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string body);
}

public record RegisterRequest(string FullName, string Email, string Phone, string PassportNo, int? InstructorId);
public record ContactsRequest(string Email, string Phone);
public record StudentDto(int Id, string FullName, string Email, string Phone, StudentStatus Status, string? Instructor);

public class StudentService
{
    private readonly SchoolDbContext _db;

    public StudentService(SchoolDbContext db) => _db = db;

    public async Task<int> RegisterAsync(RegisterRequest req)
    {
        var email = req.Email.Trim();
        if (await _db.Students.AnyAsync(s => s.Email == email))
            throw new InvalidOperationException("Ученик с таким e-mail уже есть");

        var student = new Student
        {
            FullName = req.FullName.Trim(),
            Email = email,
            Phone = req.Phone.Trim(),
            PassportNo = req.PassportNo.Trim(),
            InstructorId = req.InstructorId,
            Status = StudentStatus.Learning,
        };
        _db.Students.Add(student);
        await _db.SaveChangesAsync();
        return student.Id;
    }

    // Поиск администратора по точному e-mail из карточки.
    public async Task<StudentDto?> FindByEmailAsync(string email)
    {
        var s = await _db.Students.AsNoTracking()
            .Include(x => x.Instructor)
            .SingleOrDefaultAsync(x => x.Email == email);

        return s is null ? null : ToDto(s);
    }

    public async Task UpdateContactsAsync(int id, ContactsRequest req)
    {
        var s = await _db.Students.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new KeyNotFoundException();
        s.Email = req.Email.Trim();
        s.Phone = req.Phone.Trim();
    }

    public async Task GraduateAsync(int id, DateOnly graduatedOn)
    {
        var s = await _db.Students.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new KeyNotFoundException();
        s.Status = StudentStatus.Graduated;
        s.GraduatedOn = graduatedOn;
    }

    // CSV для инструктора (печатает и берёт с собой на площадку).
    public async Task<string> ExportForInstructorCsvAsync(int instructorId)
    {
        var students = await _db.Students
            .Where(s => s.InstructorId == instructorId && s.Status == StudentStatus.Learning)
            .OrderBy(s => s.FullName)
            .ToListAsync();

        var csv = new StringBuilder("ФИО;Телефон;E-mail;Паспорт\n");
        foreach (var s in students.Select(x => x.MaskForInstructor()))
            csv.AppendLine($"{s.FullName};{s.Phone};{s.Email};{s.PassportNo}");
        return csv.ToString();
    }

    private static StudentDto ToDto(Student s) =>
        new(s.Id, s.FullName, s.Email, s.Phone, s.Status, s.Instructor?.FullName);
}
