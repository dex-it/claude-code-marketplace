using Microsoft.Extensions.Options;
using Shop.Api.Orders;

namespace Shop.Api.Returns;

public sealed class ReturnPolicy(IOptions<ReturnsOptions> options)
{
    public bool IsWithinWindow(OrderView order) =>
        order.CreatedAt.AddDays(options.Value.WindowDays) >= DateTime.Now;
}
