using System.Text;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Domovoy.Housing;

public record RequestSearch(string? Text, RequestStatus? Status, int? HouseId, string? District,
    int Page = 1, int PageSize = 50);

public record RequestRow(int Id, DateTime CreatedAt, string Address, string Apartment,
    RequestStatus Status, string Category, string Text);

public record RequestCard(int Id, DateTime CreatedAt, string Address, string Apartment,
    RequestStatus Status, string Category, string Text);

public record NewRequest(int ApartmentId, string Text, string Category);

public class HousingService
{
    private readonly HousingDbContext _db;

    public HousingService(HousingDbContext db) => _db = db;

    public async Task<int> CreateRequestAsync(NewRequest req)
    {
        var request = new ServiceRequest
        {
            ApartmentId = req.ApartmentId,
            Text = req.Text.Trim(),
            Category = req.Category,
            Status = RequestStatus.New,
            CreatedAt = DateTime.UtcNow,
        };
        _db.ServiceRequests.Add(request);
        await _db.SaveChangesAsync();
        return request.Id;
    }

    // Карточка заявки для мастера.
    public async Task<RequestCard?> GetRequestAsync(int id)
    {
        var r = await _db.ServiceRequests
            .AsNoTracking()
            .Include(x => x.Apartment).ThenInclude(a => a.House)
            .FirstOrDefaultAsync(x => x.Id == id);

        return r is null
            ? null
            : new RequestCard(r.Id, r.CreatedAt, r.Apartment.House.Address, r.Apartment.Number,
                r.Status, r.Category, r.Text);
    }

    // Реестр заявок для диспетчерской.
    public async Task<List<RequestRow>> SearchAsync(RequestSearch s)
    {
        // Без search_vector: колонка тяжёлая и в модели её нет.
        var sql = new StringBuilder("""
            SELECT r.id, r.apartment_id, r.text, r.category, r.status, r.created_at
            FROM service_requests r
            """);
        var where = new List<string>();
        var parameters = new List<NpgsqlParameter>();

        if (s.HouseId is not null || !string.IsNullOrWhiteSpace(s.District))
            sql.Append(" JOIN apartments a ON a.id = r.apartment_id");

        if (s.HouseId is { } houseId)
        {
            where.Add("a.house_id = @house");
            parameters.Add(new NpgsqlParameter("house", houseId));
        }

        if (!string.IsNullOrWhiteSpace(s.District))
        {
            sql.Append(" JOIN houses h ON h.id = a.house_id");
            where.Add("h.district = @district");
            parameters.Add(new NpgsqlParameter("district", s.District));
        }

        if (!string.IsNullOrWhiteSpace(s.Text))
        {
            where.Add("r.search_vector @@ plainto_tsquery('russian', @text)");
            parameters.Add(new NpgsqlParameter("text", s.Text));
        }

        if (s.Status is { } status)
        {
            where.Add("r.status = @status");
            parameters.Add(new NpgsqlParameter("status", status.ToString()));
        }

        if (where.Count > 0)
            sql.Append(" WHERE ").Append(string.Join(" AND ", where));

        var pageSize = Math.Clamp(s.PageSize, 1, 200);
        var offset = (Math.Max(s.Page, 1) - 1) * pageSize;
        sql.Append(" ORDER BY r.created_at DESC");
        sql.Append($" LIMIT {pageSize} OFFSET {offset}");

        var requests = await _db.ServiceRequests
            .FromSqlRaw(sql.ToString(), parameters.ToArray())
            .AsNoTracking()
            .ToListAsync();

        var apartmentIds = requests.Select(r => r.ApartmentId).Distinct().ToList();
        var apartments = await _db.Apartments
            .AsNoTracking()
            .Where(a => apartmentIds.Contains(a.Id))
            .Select(a => new { a.Id, a.Number, a.House.Address })
            .ToDictionaryAsync(a => a.Id);

        return requests
            .Select(r => new RequestRow(r.Id, r.CreatedAt, apartments[r.ApartmentId].Address,
                apartments[r.ApartmentId].Number, r.Status, r.Category, r.Text))
            .ToList();
    }
}
