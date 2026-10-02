using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Orders.Api.Data;

namespace Orders.Api.Controllers;

[ApiController]
public class OrderExportController(OrdersDbContext db) : ControllerBase
{
    [HttpGet("api/orders/export")]
    public async Task<IActionResult> Export(string status)
    {
        var orders = await db.Orders
            .FromSqlRaw($"SELECT * FROM orders WHERE status = '{status}'")
            .AsNoTracking()
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("id;number;customer;created;total");
        foreach (var o in orders)
            sb.AppendLine($"{o.Id};{o.Number};{o.CustomerId};{o.CreatedAt:O};{o.Total}");

        return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", "orders.csv");
    }
}
