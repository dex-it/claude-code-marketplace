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
        var paid = await _payments.Find(new BsonDocument("_id", id)).FirstOrDefaultAsync(context.CancellationToken);

        if (paid is null)
        {
            var amount = msg.Total - msg.Discount;
            await _gateway.ChargeAsync(msg.OrderId, amount, context.CancellationToken);
            try
            {
                await _payments.InsertOneAsync(new BsonDocument
                {
                    { "_id", id },
                    { "amount", (Decimal128)amount },
                    { "receiptEmail", msg.ReceiptEmail },
                    { "paidAt", DateTime.UtcNow }
                }, cancellationToken: context.CancellationToken);
            }
            catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
            {
            }
            paid = new BsonDocument("amount", (Decimal128)amount);
            _logger.LogInformation("Платёж по заказу {OrderId} списан", msg.OrderId);
        }

        await context.Publish(new OrderPaid(msg.OrderId, (decimal)paid["amount"].AsDecimal128));
    }
}
