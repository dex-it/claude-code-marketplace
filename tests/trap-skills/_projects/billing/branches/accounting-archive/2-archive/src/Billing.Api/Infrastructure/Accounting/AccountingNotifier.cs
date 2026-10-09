namespace Billing.Api.Infrastructure.Accounting;

public sealed class AccountingNotifier
{
    private readonly ILogger<AccountingNotifier> _logger;

    public AccountingNotifier(ILogger<AccountingNotifier> logger)
    {
        _logger = logger;
        ArchiveEvents.Built += OnBuilt;
    }

    private void OnBuilt(string path) => _logger.LogInformation("Accounting archive {Path} is ready", path);
}
