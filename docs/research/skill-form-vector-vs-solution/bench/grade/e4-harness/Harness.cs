// Копия tests/trap-skills/dotnet-ef-core/inputs/e4-harness/Harness.cs для исследования: ClearItems ищется
// в любом типе, время сравнивается с допуском 1 мс (Postgres хранит микросекунды).
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
        var id = Guid.NewGuid(); var cust = Guid.NewGuid(); var now = DateTime.UtcNow; var writeFailed = false;
        await using (var c = new ShopDbContext(opts))
        {
            c.Customers.Add(new Customer { Id = cust, Name = "c" });
            var o = new Order { Id = id, CustomerId = cust, CreatedAt = now };
            var cp = typeof(Order).GetProperty("Complexity"); if (cp != null) cp.SetValue(o, 3);
            o.Items.Add(new OrderItem { ProductId = Guid.NewGuid(), Qty = 1 }); o.Items.Add(new OrderItem { ProductId = Guid.NewGuid(), Qty = 2 });
            o.Payments.Add(new Payment { Amount = 5 });
            c.Orders.Add(o);
            try { await c.SaveChangesAsync(); Console.WriteLine("WRITE ok"); }
            catch (Exception e) { Console.WriteLine("WRITE FAIL " + (e.InnerException?.Message ?? e.Message).Split('\n')[0]); writeFailed = true; }
        }
        if (writeFailed)
        {
            // Запасная запись - только чтобы проверить ClearItems и каскад отдельно от маппинга CreatedAt
            // (единица E4-ts уже провалена). Строка заказа вставляется сырым SQL по метаданным модели,
            // мимо конвертеров прогона; клиент, позиции и платежи - через EF (в них нет DateTime).
            await using var c = new ShopDbContext(opts);
            try
            {
                if (!await c.Customers.AnyAsync(x => x.Id == cust)) { c.Customers.Add(new Customer { Id = cust, Name = "c" }); await c.SaveChangesAsync(); }
                var et = c.Model.FindEntityType(typeof(Order))!;
                var so = Microsoft.EntityFrameworkCore.Metadata.StoreObjectIdentifier.Table(et.GetTableName()!, et.GetSchema());
                var cols = new List<string>(); var vals = new List<string>(); var ps = new List<object>();
                foreach (var p in et.GetProperties())
                {
                    var col = p.GetColumnName(so); if (col == null) continue;
                    var t = Nullable.GetUnderlyingType(p.ClrType) ?? p.ClrType;
                    string v;
                    if (p.Name == "Id") { ps.Add(id); v = $"{{{ps.Count - 1}}}"; }
                    else if (p.Name == "CustomerId") { ps.Add(cust); v = $"{{{ps.Count - 1}}}"; }
                    else if (t == typeof(DateTime)) v = "'2026-01-01 00:00:00'";
                    else if (p.IsNullable) v = "NULL";
                    else if (t == typeof(string)) v = "''";
                    else if (t == typeof(bool)) v = "false";
                    else if (t == typeof(Guid)) { ps.Add(Guid.NewGuid()); v = $"{{{ps.Count - 1}}}"; }
                    else if (t.IsEnum || t.IsPrimitive || t == typeof(decimal)) v = p.Name == "Complexity" ? "3" : "0";
                    else v = "DEFAULT";
                    cols.Add($"\"{col}\""); vals.Add(v);
                }
                await c.Database.ExecuteSqlRawAsync($"INSERT INTO \"{et.GetTableName()}\" ({string.Join(",", cols)}) VALUES ({string.Join(",", vals)})", ps.ToArray());
                c.Set<OrderItem>().Add(new OrderItem { OrderId = id, ProductId = Guid.NewGuid(), Qty = 1 });
                c.Set<OrderItem>().Add(new OrderItem { OrderId = id, ProductId = Guid.NewGuid(), Qty = 2 });
                c.Set<Payment>().Add(new Payment { OrderId = id, Amount = 5 });
                await c.SaveChangesAsync();
                Console.WriteLine("WRITE-FALLBACK ok");
            }
            catch (Exception e) { Console.WriteLine("WRITE-FALLBACK FAIL " + (e.InnerException?.Message ?? e.Message).Split('\n')[0]); return; }
        }
        await using (var c = new ShopDbContext(opts))
        {
            var o = await c.Orders.AsNoTracking().FirstAsync(x => x.Id == id);
            var drift = Math.Abs((o.CreatedAt - now).TotalMilliseconds);
            Console.WriteLine($"READ Kind={o.CreatedAt.Kind} driftMs={drift:0.###} equalsWritten={drift < 1 && o.CreatedAt.Kind == DateTimeKind.Utc}");
        }
        await using (var c = new ShopDbContext(opts))
        {
            // Метод ClearItems* ищется в любом типе сборки, а не только в OrderRepository: поручение
            // не называет класс. Экземпляр - через конструктор с одним ShopDbContext.
            var m = typeof(ShopDbContext).Assembly.GetTypes()
                .SelectMany(t => t.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
                .FirstOrDefault(x => x.Name.StartsWith("ClearItems"));
            if (m == null) { Console.WriteLine("CLEAR FAIL NoMethod: ClearItems не найден"); return; }
            var repoType = m.DeclaringType!;
            object repo;
            if (repoType.IsAssignableFrom(typeof(ShopDbContext))) repo = c;
            else
            {
                var ctor = repoType.GetConstructors().FirstOrDefault(k => k.GetParameters().Length == 1 && k.GetParameters()[0].ParameterType.IsAssignableFrom(typeof(ShopDbContext)));
                if (ctor == null) { Console.WriteLine($"CLEAR FAIL NoCtor: {repoType.Name} без конструктора (ShopDbContext)"); return; }
                repo = ctor.Invoke(new object[] { c });
            }
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
