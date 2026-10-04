using Billing.Api.Domain;

namespace Billing.Api.Application.Abstractions;

public sealed record LedgerPosting(string ExternalId, Money Amount, string Description);

public interface ILedgerGateway
{
    Task PostAsync(LedgerPosting posting, CancellationToken ct);
}
