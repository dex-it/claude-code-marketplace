using Billing.Api.Domain;

namespace Billing.Api.Application.Messages;

public sealed record LedgerPostingRequested(string ExternalId, Money Amount, string Description);
