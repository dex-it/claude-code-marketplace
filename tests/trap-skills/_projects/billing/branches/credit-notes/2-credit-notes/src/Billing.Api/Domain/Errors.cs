namespace Billing.Api.Domain;

public abstract record BillingError(string Code, string Message);

public abstract record NotFoundError(string Code, string Message) : BillingError(Code, Message);

public sealed record InvoiceNotFoundError(InvoiceId Id)
    : NotFoundError("invoice.not_found", $"Invoice {Id} not found");

public sealed record InvoiceInvalidStateError(InvoiceId Id, InvoiceStatus Status, string Operation)
    : BillingError("invoice.invalid_state", $"Invoice {Id} is {Status}, cannot {Operation}");

public sealed record ValidationError(string Field, string Message)
    : BillingError("validation", $"{Field}: {Message}");

public sealed record CreditNoteNotFoundError(Guid Id)
    : NotFoundError("credit_note.not_found", $"Credit note {Id} not found");

public sealed record CreditNoteLimitError(InvoiceId InvoiceId, int Max)
    : BillingError("credit_note.limit_reached", $"Invoice {InvoiceId} cannot have more than {Max} credit notes");

public sealed record CreditNoteExceedsInvoiceError(InvoiceId InvoiceId, long RequestedMinor, long AvailableMinor)
    : BillingError("credit_note.exceeds_invoice", $"Credit {RequestedMinor} exceeds available {AvailableMinor} of invoice {InvoiceId}");

public sealed record CreditNoteInvalidStateError(Guid Id, CreditNoteStatus Status, string Operation)
    : BillingError("credit_note.invalid_state", $"Credit note {Id} is {Status}, cannot {Operation}");
