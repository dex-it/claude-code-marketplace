namespace Fulfil.Kafka;

public static class KafkaServiceCollectionExtensions
{
    public static IServiceCollection AddKafkaPipeline(this IServiceCollection services)
    {
        services.AddSingleton<OrderStatusPublisher>();
        services.AddHostedService<OrderPlacedConsumer>();
        services.AddHostedService<OrderImportConsumer>();
        return services;
    }
}
