using Billing.Api.Domain;

namespace Billing.Api.Application.Abstractions;

public interface ICustomerBalance
{
    Task<long> GetAsync(CustomerId customerId, string currency, CancellationToken ct);
    Task CreditAsync(CustomerId customerId, Money amount, CancellationToken ct);
    Task<bool> TryDebitAsync(CustomerId customerId, Money amount, CancellationToken ct);
}

public interface IReceiptRepository
{
    Task<Receipt?> FindAsync(InvoiceId invoiceId, CancellationToken ct);
    Task SaveAsync(Receipt receipt, CancellationToken ct);
}

public interface ICustomerDirectory
{
    Task<string?> FindEmailAsync(CustomerId customerId, CancellationToken ct);
}

public interface INotificationsClient
{
    Task SendReceiptAsync(string email, Receipt receipt, CancellationToken ct);
}

public interface IAnalyticsClient
{
    Task PushInvoicePaidAsync(Invoice invoice, CancellationToken ct);
}
