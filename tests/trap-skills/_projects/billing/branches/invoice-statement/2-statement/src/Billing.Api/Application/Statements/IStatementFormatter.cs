namespace Billing.Api.Application.Statements;

public enum StatementFormat { Json }

public enum StatementGrouping { None, ByMonth, ByStatus }

public sealed record StatementRenderOptions(
    StatementGrouping Grouping = StatementGrouping.None,
    bool IncludeDrafts = false,
    string? SheetName = null,
    bool FreezeHeader = false);

public interface IStatementFormatter
{
    StatementFormat Format { get; }
    string ContentType { get; }
    byte[] Render(Statement statement, StatementRenderOptions options);
}
