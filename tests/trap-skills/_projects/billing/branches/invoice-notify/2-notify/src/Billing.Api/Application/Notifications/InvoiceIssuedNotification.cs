using Billing.Api.Domain;

namespace Billing.Api.Application.Notifications;

public sealed record InvoiceIssuedNotification(InvoiceId InvoiceId, CustomerId CustomerId, Money Amount, DateOnly DueDate);
