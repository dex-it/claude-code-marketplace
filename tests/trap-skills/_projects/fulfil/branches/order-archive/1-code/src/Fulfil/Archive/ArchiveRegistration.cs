using Fulfil.Options;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace Fulfil.Archive;

public static class ArchiveRegistration
{
    public static IServiceCollection AddOrderArchive(this IServiceCollection services)
    {
        MongoConventions.Register();

        services.TryAddSingleton<IMongoClient>(sp =>
            new MongoClient(sp.GetRequiredService<IOptions<FulfilOptions>>().Value.MongoConnectionString));
        services.TryAddSingleton(sp =>
            sp.GetRequiredService<IMongoClient>().GetDatabase(sp.GetRequiredService<IOptions<FulfilOptions>>().Value.MongoDatabase));

        services.AddSingleton<OrderStore>();
        services.AddSingleton<OrderEvents>();
        services.AddSingleton<StockTransfer>();
        services.TryAddSingleton<IMailer, LogMailer>();
        services.AddHostedService<ArchiveInitializer>();
        services.AddHostedService<ShippedWatcher>();
        services.AddHostedService<CartDraftCleaner>();
        return services;
    }
}
