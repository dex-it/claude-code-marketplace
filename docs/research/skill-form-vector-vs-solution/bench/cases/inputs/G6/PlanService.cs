using Microsoft.EntityFrameworkCore;

namespace Domovoy.Housing;

public record PlanItemDto(string WorkCode, string Title, int PeriodDays, DateOnly? LastDoneOn, DateOnly? NextDueOn);

public class PlanService
{
    private readonly HousingDbContext _db;

    public PlanService(HousingDbContext db) => _db = db;

    public async Task<List<PlanItemDto>> GetPlanAsync(int houseId)
    {
        var items = await _db.PlanItems
            .AsNoTracking()
            .Where(i => i.Plan.HouseId == houseId)
            .Select(i => new
            {
                i.WorkCode,
                i.Title,
                i.PeriodDays,
                LastDoneOn = i.Completions.Max(c => (DateOnly?)c.DoneOn),
            })
            .ToListAsync();

        return items
            .Select(i => new PlanItemDto(i.WorkCode, i.Title, i.PeriodDays, i.LastDoneOn,
                i.LastDoneOn?.AddDays(i.PeriodDays)))
            .OrderBy(i => i.NextDueOn ?? DateOnly.MinValue)
            .ToList();
    }

    public async Task MarkDoneAsync(int houseId, string workCode, DateOnly doneOn, string contractor, string actNumber)
    {
        var item = await _db.PlanItems
            .FirstOrDefaultAsync(i => i.Plan.HouseId == houseId && i.WorkCode == workCode)
            ?? throw new KeyNotFoundException($"Работа {workCode} не входит в план дома");

        item.Completions.Add(new PlanItemCompletion
        {
            DoneOn = doneOn,
            Contractor = contractor,
            ActNumber = actNumber,
        });
        await _db.SaveChangesAsync();
    }

    // Дома объединены в один комплекс: работы плана fromHouse, которых нет в плане toHouse,
    // переходят в план toHouse со своей историей выполнения.
    public async Task MergePlansAsync(int fromHouseId, int toHouseId)
    {
        var from = await _db.MaintenancePlans.Include(p => p.Items)
            .SingleAsync(p => p.HouseId == fromHouseId);
        var to = await _db.MaintenancePlans.Include(p => p.Items)
            .SingleAsync(p => p.HouseId == toHouseId);

        foreach (var item in from.Items.ToList())
        {
            if (to.Items.Any(i => i.WorkCode == item.WorkCode))
                continue;

            from.Items.Remove(item);
            to.Items.Add(item);
        }

        await _db.SaveChangesAsync();
    }
}
