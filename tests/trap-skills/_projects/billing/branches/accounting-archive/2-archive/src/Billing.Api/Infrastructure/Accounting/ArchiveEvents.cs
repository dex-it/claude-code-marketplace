namespace Billing.Api.Infrastructure.Accounting;

public static class ArchiveEvents
{
    public static event Action<string>? Built;

    public static void RaiseBuilt(string path) => Built?.Invoke(path);
}
