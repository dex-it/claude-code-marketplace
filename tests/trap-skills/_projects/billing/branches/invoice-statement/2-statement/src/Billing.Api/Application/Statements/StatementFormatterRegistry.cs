namespace Billing.Api.Application.Statements;

public sealed class StatementFormatterRegistry(IEnumerable<IStatementFormatter> formatters)
{
    private readonly Dictionary<StatementFormat, IStatementFormatter> _byFormat =
        formatters.ToDictionary(f => f.Format);

    public IStatementFormatter Resolve(StatementFormat format) =>
        _byFormat.TryGetValue(format, out var formatter)
            ? formatter
            : throw new NotSupportedException($"Statement format {format} is not registered");
}
