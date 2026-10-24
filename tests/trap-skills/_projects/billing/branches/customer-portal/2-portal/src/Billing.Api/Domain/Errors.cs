namespace Billing.Api.Domain;

public abstract record BillingError(string Code, string Message);

public abstract record NotFoundError(string Code, string Message) : BillingError(Code, Message);

public sealed record InvoiceNotFoundError(InvoiceId Id)
    : NotFoundError("invoice.not_found", $"Invoice {Id} not found");

public sealed record InvoiceInvalidStateError(InvoiceId Id, InvoiceStatus Status, string Operation)
    : BillingError("invoice.invalid_state", $"Invoice {Id} is {Status}, cannot {Operation}");

public sealed record ValidationError(string Field, string Message)
    : BillingError("validation", $"{Field}: {Message}");

public sealed record CustomerNotFoundError(CustomerId Id)
    : NotFoundError("customer.not_found", $"Customer {Id} not found");

public sealed record DocumentNotFoundError(string Name)
    : NotFoundError("document.not_found", $"Document {Name} not found");

public sealed record InvalidCredentialsError()
    : BillingError("customer.invalid_credentials", "Invalid email or password");
