namespace Billing.Api.Domain;

public sealed record Refund(Guid Id, Money Amount, DateTimeOffset At);
