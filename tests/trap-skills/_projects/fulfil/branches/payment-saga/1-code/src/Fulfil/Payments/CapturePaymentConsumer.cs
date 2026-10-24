using Fulfil.Ports;
using MassTransit;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Fulfil.Payments;

public sealed class CapturePaymentConsumer : IConsumer<CapturePayment>
{
    private readonly IPaymentGateway _gateway;
    private readonly IMongoCollection<BsonDocument> _payments;
    private readonly ILogger<CapturePaymentConsumer> _logger;

    public CapturePaymentConsumer(IPaymentGateway gateway, IMongoDatabase database, ILogger<CapturePaymentConsumer> logger)
    {
        _gateway = gateway;
        _payments = database.GetCollection<BsonDocument>("payments");
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<CapturePayment> context)
    {
        var msg = context.Message;
        var id = msg.OrderId.ToString();
        var amount = msg.Total;
        await _gateway.ChargeAsync(msg.OrderId, amount, context.CancellationToken);
        await _payments.InsertOneAsync(new BsonDocument
        {
            { "_id", id },
            { "amount", (Decimal128)amount },
            { "receiptEmail", msg.ReceiptEmail },
            { "paidAt", DateTime.UtcNow }
        }, cancellationToken: context.CancellationToken);
        _logger.LogInformation("Платёж по заказу {OrderId} для {Email} списан", msg.OrderId, msg.ReceiptEmail);

        await context.Publish(new OrderPaid(msg.OrderId, amount));
    }
}
