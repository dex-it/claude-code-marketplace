using Microsoft.EntityFrameworkCore;

namespace Tarif.Billing;

public record LeadRequest(string FullName, string Phone, string Address);
public record ContractRequest(string ContractNo, int TariffId);
public record SubscriberDto(int Id, string FullName, string Phone, string Address, string? ContractNo,
    SubscriberStatus Status, decimal Balance);

public class SubscriberService
{
    private readonly BillingDbContext _db;

    public SubscriberService(BillingDbContext db) => _db = db;

    public async Task<int> CreateLeadAsync(LeadRequest req)
    {
        var s = new Subscriber
        {
            FullName = req.FullName.Trim(),
            Phone = req.Phone.Trim(),
            Address = req.Address.Trim(),
            Status = SubscriberStatus.Lead,
            CreatedAt = DateTime.Now,
        };
        _db.Subscribers.Add(s);
        await _db.SaveChangesAsync();
        return s.Id;
    }

    public async Task SignContractAsync(int id, ContractRequest req)
    {
        var s = await _db.Subscribers.FindAsync(id) ?? throw new KeyNotFoundException();
        if (s.Status != SubscriberStatus.Lead)
            throw new InvalidOperationException("Договор уже подписан");

        s.ContractNo = req.ContractNo;
        s.TariffId = req.TariffId;
        s.Status = SubscriberStatus.Active;
        s.ConnectedAt = DateTime.Now;
        await _db.SaveChangesAsync();
    }

    public async Task<SubscriberDto?> GetByContractAsync(string contractNo)
    {
        var s = await _db.Subscribers.AsNoTracking()
            .SingleOrDefaultAsync(x => x.ContractNo == contractNo);

        return s is null
            ? null
            : new SubscriberDto(s.Id, s.FullName, s.Phone, s.Address, s.ContractNo, s.Status, s.Balance);
    }
}
