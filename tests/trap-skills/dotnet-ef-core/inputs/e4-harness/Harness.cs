using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Shop.Data;

public static class Harness
{
    public static async Task Main(string[] a)
    {
        var db = a[0];
        var cs = $"Host=localhost;Port=55432;Username=postgres;Password=pw;Database={db}";
        var opts = new DbContextOptionsBuilder<ShopDbContext>().UseNpgsql(cs).Options;
        await using (var c = new ShopDbContext(opts)) { await c.Database.EnsureDeletedAsync(); await c.Database.EnsureCreatedAsync(); }
        await using (var c = new ShopDbContext(opts))
        {
            var ddl = c.Database.GenerateCreateScript();
            foreach (var l in ddl.Split('\n').Where(l => l.Contains("REFERENCES \"Orders\""))) Console.WriteLine("DDL  " + l.Trim());
        }
        var id = Guid.NewGuid(); var cust = Guid.NewGuid(); var now = DateTime.UtcNow;
        await using (var c = new ShopDbContext(opts))
        {
            c.Customers.Add(new Customer { Id = cust, Name = "c" });
            var o = new Order { Id = id, CustomerId = cust, CreatedAt = now };
            var cp = typeof(Order).GetProperty("Complexity"); if (cp != null) cp.SetValue(o, 3);
            o.Items.Add(new OrderItem { ProductId = Guid.NewGuid(), Qty = 1 }); o.Items.Add(new OrderItem { ProductId = Guid.NewGuid(), Qty = 2 });
            o.Payments.Add(new Payment { Amount = 5 });
            c.Orders.Add(o);
            try { await c.SaveChangesAsync(); Console.WriteLine("WRITE ok"); }
            catch (Exception e) { Console.WriteLine("WRITE FAIL " + (e.InnerException?.Message ?? e.Message).Split('\n')[0]); return; }
        }
        await using (var c = new ShopDbContext(opts))
        {
            var o = await c.Orders.AsNoTracking().FirstAsync(x => x.Id == id);
            Console.WriteLine($"READ Kind={o.CreatedAt.Kind} equalsWritten={o.CreatedAt == now && o.CreatedAt.Kind == DateTimeKind.Utc}");
        }
        await using (var c = new ShopDbContext(opts))
        {
            var repoType = typeof(ShopDbContext).Assembly.GetTypes().First(t => t.Name == "OrderRepository");
            var repo = Activator.CreateInstance(repoType, c)!;
            var m = repoType.GetMethods().First(x => x.Name.StartsWith("ClearItems"));
            try
            {
                var args = m.GetParameters().Select(p => p.ParameterType == typeof(Guid) ? (object)id : (p.HasDefaultValue ? p.DefaultValue : null)).ToArray();
                var r = m.Invoke(repo, args); if (r is Task t) await t;
                await using var c2 = new ShopDbContext(opts);
                var left = await c2.Set<OrderItem>().CountAsync(i => i.OrderId == id);
                Console.WriteLine($"CLEAR ok, items left in DB = {left}");
            }
            catch (Exception e) { var ie = e is TargetInvocationException ? e.InnerException! : e; Console.WriteLine("CLEAR FAIL " + ie.GetType().Name + ": " + ie.Message.Split('.')[0]); }
        }
        // physical delete of order row (manual SQL / DBA)
        await using (var c = new ShopDbContext(opts))
        {
            try { await c.Database.ExecuteSqlRawAsync("DELETE FROM \"Orders\" WHERE \"Id\" = {0}", id); var n = await c.Set<Payment>().CountAsync(p => p.OrderId == id); Console.WriteLine($"SQL DELETE order -> payments left = {n}"); }
            catch (Exception e) { Console.WriteLine("SQL DELETE blocked: " + e.Message.Split('\n')[0]); }
        }
    }
}
