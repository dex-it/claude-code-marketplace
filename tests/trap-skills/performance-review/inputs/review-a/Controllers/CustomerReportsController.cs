using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Orders.Api.Data;

namespace Orders.Api.Controllers;

public record CustomerSummary(int Id, string Name, int LinesTotal, int RecentOrders);

[ApiController]
public class CustomerReportsController(OrdersDbContext db, ILogger<CustomerReportsController> logger) : ControllerBase
{
    [HttpGet("api/customers/{customerId:int}/summary")]
    public async Task<ActionResult<CustomerSummary>> Summary(int customerId, DateTime? since)
    {
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == customerId);
        if (customer is null) return NotFound();

        var orders = await db.Orders.Where(o => o.CustomerId == customerId).ToListAsync();
        var linesTotal = 0m;
        foreach (var order in orders)
            linesTotal += order.Lines.Sum(l => l.Quantity * l.UnitPrice);

        var from = since ?? DateTime.UtcNow.AddDays(-30);
        var allOrders = await db.Orders.ToListAsync();
        var recentOrders = allOrders.Count(o => o.CustomerId == customerId && o.CreatedAt >= from);

        logger.LogDebug($"Summary for customer {customerId}: {JsonSerializer.Serialize(orders)}");

        return new CustomerSummary(customer.Id, customer.Name, (int)linesTotal, recentOrders);
    }

    [HttpGet("api/customers/{customerId:int}/has-orders")]
    public async Task<bool> HasOrders(int customerId)
    {
        var count = await db.Orders.CountAsync(o => o.CustomerId == customerId);
        return count > 0;
    }

    [HttpGet("api/customers/mailing-list")]
    public async Task<IEnumerable<string>> MailingList(int page = 0, int pageSize = 500)
    {
        var customers = await db.Customers
            .Where(c => c.AcceptsMarketing)
            .OrderBy(c => c.Id)
            .Skip(page * pageSize)
            .Take(pageSize)
            .ToListAsync();
        return customers.Select(c => c.Email);
    }
}
