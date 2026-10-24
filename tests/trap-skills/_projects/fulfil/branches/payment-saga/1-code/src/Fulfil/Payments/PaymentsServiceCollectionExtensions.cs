using Fulfil.Options;
using MassTransit;
using Microsoft.Extensions.Options;

namespace Fulfil.Payments;

public static class PaymentsServiceCollectionExtensions
{
    public static IServiceCollection AddPaymentSaga(this IServiceCollection services)
    {
        services.AddHostedService<WarehouseInboundConsumer>();
        services.AddMassTransit(x =>
        {
            x.AddConsumer<CapturePaymentConsumer>();
            x.AddConsumer<OrderShippedConsumer>();
            x.AddConsumer<StockLevelsConsumer, StockLevelsConsumerDefinition>();
            x.AddSagaStateMachine<OrderFulfilmentStateMachine, OrderState>()
                .InMemoryRepository();

            x.UsingRabbitMq((context, cfg) =>
            {
                var options = context.GetRequiredService<IOptions<FulfilOptions>>().Value;
                cfg.Host(options.RabbitMqHost, "/", _ => { });
                cfg.UseMessageRetry(r => r.Immediate(int.MaxValue));
                cfg.ConfigureEndpoints(context);
            });
        });
        return services;
    }
}
