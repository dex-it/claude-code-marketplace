using Shop.Api.Data;

namespace Shop.Api.Returns;

public sealed class ReturnMapper
{
    public ReturnListItem ToListItem(ReturnRequest r)
    {
        var amount = 0m;
        foreach (var line in r.Lines)
        {
            var orderLine = r.Order.Lines.First(l => l.Id == line.OrderLineId);
            amount += orderLine.UnitPrice * line.Quantity;
        }

        return new ReturnListItem(
            r.Id,
            r.OrderId,
            r.Order.Customer.Name,
            r.Status,
            r.CreatedAt,
            r.Lines.Sum(l => l.Quantity),
            amount);
    }
}
