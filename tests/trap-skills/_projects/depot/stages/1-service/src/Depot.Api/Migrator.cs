using Npgsql;

namespace Depot.Api;

public sealed record ApiKeyOptions(string Key);

public static class Migrator
{
    // Миграции применяются при старте процесса, до приёма трафика.
    public static async Task RunAsync(NpgsqlDataSource db)
    {
        await using var cmd = db.CreateCommand(
            "create table if not exists stock(sku text not null, warehouse text not null, quantity int not null, primary key (sku, warehouse))");
        await cmd.ExecuteNonQueryAsync();
    }
}
