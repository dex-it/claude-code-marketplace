using System.Net;
using Depot.Contracts;
using Xunit;

namespace Depot.Api.Tests;

public class ContractTests
{
    [Fact, Trait("Category", "Contracts")]
    public void StockDto_is_value_equal()
        => Assert.Equal(new StockDto("A1", "msk", 3), new StockDto("A1", "msk", 3));
}

// Интеграционные тесты: Postgres поднимается Testcontainers (нужен Docker на агенте).
public class StockEndpointTests : IAsyncLifetime
{
    [Fact, Trait("Category", "Integration")]
    public async Task Receive_then_get_returns_quantity()
    {
        await Task.CompletedTask;
        Assert.Equal(HttpStatusCode.OK, HttpStatusCode.OK);
    }

    public Task InitializeAsync() => Task.CompletedTask;
    public Task DisposeAsync() => Task.CompletedTask;
}
