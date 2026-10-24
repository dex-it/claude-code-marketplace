namespace Billing.Api.Domain;

public abstract record BillingError(string Code, string Message);

public abstract record NotFoundError(string Code, string Message) : BillingError(Code, Message);

public sealed record InvoiceNotFoundError(InvoiceId Id)
    : NotFoundError("invoice.not_found", $"Invoice {Id} not found");

public sealed record InvoiceInvalidStateError(InvoiceId Id, InvoiceStatus Status, string Operation)
    : BillingError("invoice.invalid_state", $"Invoice {Id} is {Status}, cannot {Operation}");

public sealed record ValidationError(string Field, string Message)
    : BillingError("validation", $"{Field}: {Message}");

public sealed record SubscriptionNotFoundError(SubscriptionId Id)
    : NotFoundError("subscription.not_found", $"Subscription {Id} not found");

public sealed record SubscriptionItemNotFoundError(Guid ItemId)
    : NotFoundError("subscription.item_not_found", $"Subscription item {ItemId} not found");

public sealed record SubscriptionItemLimitError(SubscriptionId Id, int Max)
    : BillingError("subscription.item_limit", $"Subscription {Id} cannot have more than {Max} items");

public sealed record SubscriptionInvalidStateError(SubscriptionId Id, SubscriptionStatus Status, string Operation)
    : BillingError("subscription.invalid_state", $"Subscription {Id} is {Status}, cannot {Operation}");
