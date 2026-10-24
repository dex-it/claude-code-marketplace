using Fulfil.Options;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using StackExchange.Redis;

namespace Fulfil.Caching;

public static class RedisConnection
{
    public static ConfigurationOptions Build(FulfilOptions o)
    {
        var options = ConfigurationOptions.Parse(o.RedisConfiguration);
        options.AbortOnConnectFail = false;
        options.ConnectRetry = 5;
        options.ClientName = "fulfil";
        return options;
    }

    public static IServiceCollection AddRedisCaching(this IServiceCollection services)
    {
        services.AddSingleton<IConnectionMultiplexer>(sp =>
            ConnectionMultiplexer.Connect(Build(sp.GetRequiredService<IOptions<FulfilOptions>>().Value)));
        services.TryAddSingleton<IMongoClient>(sp =>
            new MongoClient(sp.GetRequiredService<IOptions<FulfilOptions>>().Value.MongoConnectionString));
        services.TryAddSingleton(sp =>
            sp.GetRequiredService<IMongoClient>().GetDatabase(sp.GetRequiredService<IOptions<FulfilOptions>>().Value.MongoDatabase));

        services.AddSingleton<PriceCache>();
        services.AddSingleton<OrderStatusCache>();
        services.AddSingleton<RedisLock>();
        services.AddSingleton<CartStore>();
        services.AddSingleton<MailJobQueue>();
        services.TryAddSingleton<IMailSender, LogMailSender>();
        services.AddHostedService<StockRecalculatorJob>();
        services.AddHostedService<MailWorker>();
        return services;
    }
}
