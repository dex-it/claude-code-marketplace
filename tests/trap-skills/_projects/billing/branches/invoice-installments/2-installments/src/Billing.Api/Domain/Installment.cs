namespace Billing.Api.Domain;

public sealed record Installment(Guid Id, int Number, Money Amount, DateOnly DueDate);
