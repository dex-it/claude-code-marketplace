namespace Billing.Api.Domain;

public abstract record BillingError(string Code, string Message);

public abstract record NotFoundError(string Code, string Message) : BillingError(Code, Message);

public sealed record InvoiceNotFoundError(InvoiceId Id)
    : NotFoundError("invoice.not_found", $"Invoice {Id} not found");

public sealed record InvoiceInvalidStateError(InvoiceId Id, InvoiceStatus Status, string Operation)
    : BillingError("invoice.invalid_state", $"Invoice {Id} is {Status}, cannot {Operation}");

public sealed record ValidationError(string Field, string Message)
    : BillingError("validation", $"{Field}: {Message}");

public sealed record InvoiceDiscountExistsError(InvoiceId Id)
    : BillingError("invoice.discount_exists", $"Invoice {Id} already has a discount");

public sealed record InvoiceDiscountTooLargeError(InvoiceId Id, long DiscountMinor, long AmountMinor)
    : BillingError("invoice.discount_too_large", $"Discount {DiscountMinor} must be less than invoice amount {AmountMinor}");
