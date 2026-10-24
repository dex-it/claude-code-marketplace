namespace Billing.Api.Application.Abstractions;

public interface IStatementArchive
{
    Task SaveAsync(string fileName, Stream content, CancellationToken ct);
}
