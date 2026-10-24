namespace Fulfil.Options;

public sealed class FulfilOptions
{
    public string KafkaBootstrapServers { get; set; } = "localhost:9092";
    public string RabbitMqHost { get; set; } = "localhost";
    public string RedisConfiguration { get; set; } = "localhost:6379";
    public string MongoConnectionString { get; set; } = "mongodb://localhost:27017";
    public string MongoDatabase { get; set; } = "fulfil";
    public string ElasticUri { get; set; } = "http://localhost:9200";
}
