using GrantDesk.Models;

namespace GrantDesk.Services;

public static class ConflictOfInterest
{
    /// <summary>Заявки, которые эксперт не может оценивать по положению о конкурсе.</summary>
    public static IReadOnlyList<int> Find(Expert expert, IEnumerable<GrantApplication> applications) =>
        applications
            .Where(a => a.ApplicantId == expert.Id)
            .Select(a => a.Id)
            .ToList();
}
