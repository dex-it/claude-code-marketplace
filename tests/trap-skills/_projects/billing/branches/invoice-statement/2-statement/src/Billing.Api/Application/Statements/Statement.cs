using Billing.Api.Domain;

namespace Billing.Api.Application.Statements;

public sealed record StatementLine(InvoiceId InvoiceId, DateOnly Date, InvoiceStatus Status, Money Amount, Money Converted);

public sealed record Statement(CustomerId CustomerId, DateOnly From, DateOnly To, IReadOnlyList<StatementLine> Lines, Money Total);
