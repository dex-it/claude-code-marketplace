using System.Globalization;
using System.Text;
using HoneyCoop.Contracts;
using HoneyCoop.Data;
using HoneyCoop.Models;
using Microsoft.EntityFrameworkCore;

namespace HoneyCoop.Services;

public class BankRegistryService
{
    private readonly CoopDbContext _db;
    private readonly IBankGateway _bank;
    private readonly ILogger<BankRegistryService> _logger;

    public BankRegistryService(CoopDbContext db, IBankGateway bank, ILogger<BankRegistryService> logger)
    {
        _db = db;
        _bank = bank;
        _logger = logger;
    }

    /// <summary>Выгружает в банк реестр утверждённых выплат, которые ещё не попадали в реестр.</summary>
    public async Task<RegistryDto?> ExportAsync(CancellationToken ct)
    {
        var payouts = await _db.Payouts
            .Include(p => p.Member)
            .Where(p => p.Status == PayoutStatus.Approved && p.ExportedAt == null && p.NetAmount > 0)
            .OrderBy(p => p.Id)
            .ToListAsync(ct);
        if (payouts.Count == 0)
            return null;

        var now = DateTime.UtcNow;
        var fileName = $"honeycoop-{now:yyyyMMdd-HHmmss}.txt";
        var content = Build(payouts);

        // Помечаем до отправки: если отправка повторится, эти выплаты в новый реестр уже не попадут.
        foreach (var payout in payouts)
        {
            payout.ExportedAt = now;
            payout.RegistryFile = fileName;
        }
        await _db.SaveChangesAsync(ct);

        try
        {
            await _bank.UploadRegistryAsync(fileName, content, ct);
        }
        catch (BankGatewayException ex)
        {
            _logger.LogError(ex, "Registry {FileName} upload failed", fileName);
        }

        return new RegistryDto(fileName, payouts.Count, payouts.Sum(p => p.NetAmount));
    }

    private static byte[] Build(IReadOnlyList<Payout> payouts)
    {
        var sb = new StringBuilder();
        foreach (var p in payouts)
        {
            sb.Append(p.Member.BankAccount).Append(';')
              .Append(p.Member.Bik).Append(';')
              .Append(p.Member.FullName).Append(';')
              .Append(p.NetAmount.ToString("0.00", CultureInfo.InvariantCulture)).Append(';')
              .Append($"Оплата за мёд, {p.Month:00}.{p.Year}")
              .Append("\r\n");
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }
}
