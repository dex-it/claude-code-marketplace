using Microsoft.EntityFrameworkCore;

namespace Pixelwork.Timesheets;

public record ProjectListItem(int Id, string Code, string Name, string Client, decimal HourlyRate);

public record ProjectFilter(int? ClientId, string? Search);

public record CreateProjectRequest(int ClientId, string Code, string Name, decimal HourlyRate);

public class ProjectService
{
    private readonly AgencyDbContext _db;

    public ProjectService(AgencyDbContext db) => _db = db;

    public async Task<List<ProjectListItem>> ListAsync(ProjectFilter f)
    {
        var q = _db.Projects.AsNoTracking().AsQueryable();

        if (f.ClientId is { } clientId)
            q = q.Where(p => p.ClientId == clientId);

        if (!string.IsNullOrWhiteSpace(f.Search))
            q = q.Where(p => EF.Functions.ILike(p.Name, $"%{f.Search}%") || p.Code == f.Search);

        return await q
            .OrderBy(p => p.Code)
            .Select(p => new ProjectListItem(p.Id, p.Code, p.Name, p.Client.Name, p.HourlyRate))
            .ToListAsync();
    }

    public async Task<int> CreateAsync(CreateProjectRequest req)
    {
        var code = req.Code.Trim().ToUpperInvariant();
        if (await _db.Projects.AnyAsync(p => p.Code == code))
            throw new InvalidOperationException($"Проект с кодом {code} уже есть");

        var project = new Project
        {
            ClientId = req.ClientId,
            Code = code,
            Name = req.Name.Trim(),
            HourlyRate = req.HourlyRate,
        };
        _db.Projects.Add(project);
        await _db.SaveChangesAsync();
        return project.Id;
    }

    public async Task<bool> DeleteProjectAsync(int id)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id);
        if (project is null)
            return false;

        _db.Projects.Remove(project);
        await _db.SaveChangesAsync();
        return true;
    }

    // Восстановление удалённого проекта вместе с его часами. Появилось весной 2026;
    // до этого удалённый по ошибке проект менеджеры заводили заново под тем же кодом.
    public async Task<bool> RestoreProjectAsync(int id)
    {
        var project = await _db.Projects
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == id && p.IsDeleted);
        if (project is null)
            return false;

        project.IsDeleted = false;
        project.DeletedAt = null;
        await _db.SaveChangesAsync();
        return true;
    }
}
