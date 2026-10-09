using System.Collections.Concurrent;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Crm;

namespace Billing.Api.Infrastructure.Reconciliation;

public sealed class ReminderSender(CrmClient crm, ILogger<ReminderSender> logger)
{
    private static readonly ConcurrentDictionary<Guid, CustomerContacts> Contacts = new();

    public async Task SendAsync(Invoice invoice, CancellationToken ct)
    {
        if (!Contacts.TryGetValue(invoice.CustomerId.Value, out var contacts))
        {
            logger.LogInformation("Contacts cache miss for customer {CustomerId}", invoice.CustomerId);
            contacts = await crm.GetContactsAsync(invoice.CustomerId.Value, ct);
            Contacts[invoice.CustomerId.Value] = contacts;
        }

        await crm.SendReminderAsync(contacts, $"Счёт {invoice.Id} нужно оплатить до {invoice.DueDate:dd.MM.yyyy}", ct);
        logger.LogInformation("Reminder for invoice {InvoiceId} sent to {Email}, {Phone}", invoice.Id, contacts.Email, contacts.Phone);
    }
}
