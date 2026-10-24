using Npgsql;

namespace OrdersApi.Orders;

public interface IOrderRepository
{
    Task SaveAsync(Order o, CancellationToken ct);
    Task<Order?> FindAsync(Guid id, CancellationToken ct);
}

public class OrderRepository(IConfiguration cfg) : IOrderRepository
{
    private readonly string _cs = cfg.GetConnectionString("Orders")!;

    public async Task SaveAsync(Order o, CancellationToken ct)
    {
        await using var c = new NpgsqlConnection(_cs);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("insert into orders(id, customer_id, channel, status, total, created_at) values (@id,@c,@ch,@s,@t,@at)", c);
        cmd.Parameters.AddWithValue("id", o.Id); cmd.Parameters.AddWithValue("c", o.CustomerId);
        cmd.Parameters.AddWithValue("ch", o.Channel); cmd.Parameters.AddWithValue("s", o.Status);
        cmd.Parameters.AddWithValue("t", o.Total); cmd.Parameters.AddWithValue("at", o.CreatedAt);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<Order?> FindAsync(Guid id, CancellationToken ct)
    {
        await using var c = new NpgsqlConnection(_cs);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("select id, customer_id, channel, status, total, created_at from orders where id=@id", c);
        cmd.Parameters.AddWithValue("id", id);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        return await r.ReadAsync(ct) ? new Order(r.GetGuid(0), r.GetGuid(1), r.GetString(2), r.GetString(3), r.GetDecimal(4), r.GetDateTime(5)) : null;
    }
}
