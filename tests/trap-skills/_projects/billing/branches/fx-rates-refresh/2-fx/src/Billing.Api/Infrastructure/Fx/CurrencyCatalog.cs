namespace Billing.Api.Infrastructure.Fx;

public sealed class CurrencyCatalog
{
    private readonly object _gate = new();
    private readonly string _path;
    private readonly FileSystemWatcher _watcher;
    private readonly ILogger<CurrencyCatalog> _logger;
    private HashSet<string> _codes = [];

    public CurrencyCatalog(IHostEnvironment env, ILogger<CurrencyCatalog> logger)
    {
        _logger = logger;
        _path = Path.Combine(env.ContentRootPath, "config", "currencies.txt");
        _watcher = new FileSystemWatcher(Path.GetDirectoryName(_path)!, Path.GetFileName(_path)) { EnableRaisingEvents = true };
        _watcher.Changed += OnChanged;
        _ = ReloadAsync(CancellationToken.None);
    }

    public bool IsSupported(string currency) => _codes.Contains(currency);

    private async void OnChanged(object sender, FileSystemEventArgs e)
    {
        await ReloadAsync(CancellationToken.None);
        _logger.LogInformation("Currency catalog reloaded from {Path}", e.FullPath);
    }

    private async Task ReloadAsync(CancellationToken ct)
    {
        Monitor.Enter(_gate);
        try
        {
            var lines = await Task.Run(() => File.ReadAllLines(_path), ct);
            _codes = lines.Select(l => l.Trim()).Where(l => l.Length == 3).ToHashSet();
        }
        finally
        {
            Monitor.Exit(_gate);
        }
    }
}
