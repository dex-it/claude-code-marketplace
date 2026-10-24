using Fulfil.Options;
using MassTransit;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace Fulfil.Payments;

public static class PaymentsServiceCollectionExtensions
{
    public static IServiceCollection AddPaymentSaga(this IServiceCollection services)
    {
        services.AddHostedService<WarehouseInboundConsumer>();
        services.AddHostedService<OrderSubmittedRelay>();
        services.AddMassTransit(x =>
        {
            x.AddConsumer<CapturePaymentConsumer>();
            x.AddConsumer<OrderShippedConsumer>();
            x.AddConsumer<StockLevelsConsumer, StockLevelsConsumerDefinition>();
            x.AddSagaStateMachine<OrderFulfilmentStateMachine, OrderState>()
                .MongoDbRepository(r => r.DatabaseFactory(provider => provider.GetRequiredService<IMongoDatabase>()));

            x.UsingRabbitMq((context, cfg) =>
            {
                var options = context.GetRequiredService<IOptions<FulfilOptions>>().Value;
                cfg.Host(options.RabbitMqHost, "/", _ => { });
                cfg.UseMessageRetry(r => r.Intervals(TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(30)));
                cfg.ConfigureEndpoints(context);
            });
        });
        return services;
    }
}
