using Acme.Ledger.Client;
using Billing.Api.Application.Abstractions;
using Microsoft.Extensions.Options;

namespace Billing.Api.Infrastructure.Ledger;

public sealed class AcmeLedgerGateway(LedgerClient client, IOptions<LedgerOptions> options) : ILedgerGateway
{
    public Task PostAsync(LedgerPosting posting, CancellationToken ct) =>
        client.PostEntryAsync(new LedgerEntry
        {
            ExternalId = posting.ExternalId,
            Account = options.Value.Account,
            AmountMinor = posting.Amount.Minor,
            Currency = posting.Amount.Currency,
            Description = posting.Description,
        }, ct);
}
