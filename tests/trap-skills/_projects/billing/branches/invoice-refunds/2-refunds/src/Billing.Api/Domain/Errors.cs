namespace Billing.Api.Domain;

public abstract record BillingError(string Code, string Message);

public abstract record NotFoundError(string Code, string Message) : BillingError(Code, Message);

public sealed record InvoiceNotFoundError(InvoiceId Id)
    : NotFoundError("invoice.not_found", $"Invoice {Id} not found");

public sealed record InvoiceInvalidStateError(InvoiceId Id, InvoiceStatus Status, string Operation)
    : BillingError("invoice.invalid_state", $"Invoice {Id} is {Status}, cannot {Operation}");

public sealed record ValidationError(string Field, string Message)
    : BillingError("validation", $"{Field}: {Message}");

public sealed record RefundExceedsAmountError(InvoiceId Id, long AvailableMinor)
    : BillingError("refund.exceeds_amount", $"Invoice {Id}: refund exceeds available {AvailableMinor}");
