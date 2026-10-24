namespace Billing.Api.Infrastructure.Accounting;

public sealed class TempArchiveFile(string path)
{
    public string Path { get; } = path;

    ~TempArchiveFile()
    {
        File.Delete(Path);
    }
}
