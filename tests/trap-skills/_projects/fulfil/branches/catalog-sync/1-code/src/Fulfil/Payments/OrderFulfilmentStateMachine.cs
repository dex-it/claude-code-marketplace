using MassTransit;
using MongoDB.Bson.Serialization.Attributes;

namespace Fulfil.Payments;

public sealed class OrderState : SagaStateMachineInstance, ISagaVersion
{
    [BsonId] public Guid CorrelationId { get; set; }
    public int Version { get; set; }
    public string CurrentState { get; set; } = "";
    public decimal Total { get; set; }
    public decimal Discount { get; set; }
    public string ReceiptEmail { get; set; } = "";
}

public sealed class OrderFulfilmentStateMachine : MassTransitStateMachine<OrderState>
{
    public State Reserving { get; private set; } = null!;
    public State Capturing { get; private set; } = null!;
    public State Shipping { get; private set; } = null!;
    public State Failed { get; private set; } = null!;

    public Event<OrderSubmitted> OrderSubmitted { get; private set; } = null!;
    public Event<StockReserved> StockReserved { get; private set; } = null!;
    public Event<StockUnavailable> StockUnavailable { get; private set; } = null!;
    public Event<OrderPaid> OrderPaid { get; private set; } = null!;
    public Event<Fault<CapturePayment>> PaymentFailed { get; private set; } = null!;
    public Event<OrderShipped> OrderShipped { get; private set; } = null!;

    public OrderFulfilmentStateMachine()
    {
        InstanceState(x => x.CurrentState);

        Event(() => OrderSubmitted, x => x.CorrelateById(ctx => ctx.Message.OrderId));
        Event(() => StockReserved, x => x.CorrelateById(ctx => ctx.Message.OrderId));
        Event(() => StockUnavailable, x => x.CorrelateById(ctx => ctx.Message.OrderId));
        Event(() => OrderPaid, x => x.CorrelateById(ctx => ctx.Message.OrderId));
        Event(() => PaymentFailed, x => x.CorrelateById(ctx => ctx.Message.Message.OrderId));
        Event(() => OrderShipped, x => x.CorrelateById(ctx => ctx.Message.OrderId));

        Initially(
            When(OrderSubmitted)
                .Then(ctx =>
                {
                    ctx.Saga.Total = ctx.Message.Total;
                    ctx.Saga.Discount = ctx.Message.Discount;
                    ctx.Saga.ReceiptEmail = ctx.Message.ReceiptEmail;
                })
                .Publish(ctx => new ReserveStock(ctx.Saga.CorrelationId, ctx.Message.Lines))
                .TransitionTo(Reserving));

        During(Reserving,
            Ignore(OrderSubmitted),
            When(StockReserved)
                .Publish(ctx => new CapturePayment(ctx.Saga.CorrelationId, ctx.Saga.Total, ctx.Saga.Discount, ctx.Saga.ReceiptEmail))
                .TransitionTo(Capturing),
            When(StockUnavailable).TransitionTo(Failed));

        During(Capturing,
            Ignore(OrderSubmitted),
            When(OrderPaid)
                .Publish(ctx => new ShipOrder(ctx.Saga.CorrelationId))
                .TransitionTo(Shipping),
            When(PaymentFailed)
                .Publish(ctx => new ReleaseStock(ctx.Saga.CorrelationId))
                .TransitionTo(Failed));

        During(Shipping,
            Ignore(OrderSubmitted),
            When(OrderShipped).Finalize());

        SetCompletedWhenFinalized();
    }
}
