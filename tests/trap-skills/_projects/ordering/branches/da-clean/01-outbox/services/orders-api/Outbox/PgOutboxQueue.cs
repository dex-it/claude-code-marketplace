using Npgsql;

namespace OrdersApi.Outbox;

public class PgOutboxQueue(IConfiguration cfg) : IOutboxQueue
{
    private string Cs => cfg.GetConnectionString("Orders")!;

    public async Task EnqueueAsync(OutboxMessage m, CancellationToken ct)
    {
        await using var c = new NpgsqlConnection(Cs);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("insert into outbox(id, type, payload, created_at) values (@id,@t,@p, now())", c);
        cmd.Parameters.AddWithValue("id", m.Id); cmd.Parameters.AddWithValue("t", m.Type); cmd.Parameters.AddWithValue("p", m.Payload);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<IReadOnlyList<OutboxMessage>> TakeBatchAsync(int max, CancellationToken ct)
    {
        await using var c = new NpgsqlConnection(Cs);
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("update outbox set locked_until = now() + interval '30 seconds' where id in (select id from outbox where sent_at is null and (locked_until is null or locked_until < now()) order by created_at limit @max for update skip locked) returning id, type, payload, created_at", c);
        cmd.Parameters.AddWithValue("max", max);
        var list = new List<OutboxMessage>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct)) list.Add(new OutboxMessage(r.GetGuid(0), r.GetString(1), r.GetString(2), r.GetDateTime(3)));
        return list;
    }
}
