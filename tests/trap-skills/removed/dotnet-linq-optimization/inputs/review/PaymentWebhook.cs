using Microsoft.EntityFrameworkCore;

namespace Shop;

public record PaymentNotice(string ExternalId, Guid OrderId, decimal Amount, DateTime PaidAt);

public record PaymentBatch(IReadOnlyList<PaymentNotice> Payments);

public class PaymentWebhook
{
    private const decimal BonusRate = 0.01m;

    private readonly ShopDbContext _db;
    public PaymentWebhook(ShopDbContext db) => _db = db;

    public async Task Handle(PaymentBatch batch, CancellationToken ct = default)
    {
        foreach (var notice in batch.Payments)
        {
            var order = await _db.Orders.SingleAsync(o => o.Id == notice.OrderId, ct);

            _db.Payments.Add(new Payment
            {
                Id = Guid.NewGuid(),
                ExternalId = notice.ExternalId,
                OrderId = notice.OrderId,
                Amount = notice.Amount,
                PaidAt = notice.PaidAt
            });
            order.Status = "Paid";

            var account = await _db.BonusAccounts.SingleOrDefaultAsync(a => a.CustomerId == order.CustomerId, ct);
            if (account is null)
            {
                account = new BonusAccount { Id = Guid.NewGuid(), CustomerId = order.CustomerId };
                _db.BonusAccounts.Add(account);
            }
            account.Balance += notice.Amount * BonusRate;
        }

        await _db.SaveChangesAsync(ct);
    }
}
