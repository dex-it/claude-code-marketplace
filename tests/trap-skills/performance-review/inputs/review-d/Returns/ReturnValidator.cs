using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Shop.Api.Data;
using Shop.Api.Orders;

namespace Shop.Api.Returns;

public sealed class ReturnValidator(ShopDbContext db, ReturnPolicy policy, IOptions<ReturnsOptions> options)
{
    public async Task<IReadOnlyList<string>> ValidateAsync(CreateReturnCommand cmd, OrderView order, CancellationToken ct)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(cmd.Reason))
            errors.Add("Укажите причину возврата");
        if (cmd.Lines.Count == 0 || cmd.Lines.Count > options.Value.MaxLinesPerRequest)
            errors.Add("Недопустимое число позиций");
        if (!policy.IsWithinWindow(order))
            errors.Add("Срок возврата истёк");

        if (await db.ReturnRequests.CountAsync(r => r.OrderId == cmd.OrderId && r.Status != ReturnStatus.Rejected, ct) > 0)
            errors.Add("По заказу уже есть заявка на возврат");

        foreach (var line in cmd.Lines)
        {
            var orderLine = order.Lines.FirstOrDefault(l => l.Id == line.OrderLineId);
            if (orderLine is null)
                errors.Add($"Позиция {line.OrderLineId} не из этого заказа");
            else if (line.Quantity <= 0 || orderLine.Quantity < 0)
                errors.Add($"Неверное количество по позиции {line.OrderLineId}");
        }

        return errors;
    }
}
