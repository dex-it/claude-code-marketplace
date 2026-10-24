using System.Text.Json;
using System.Text.Json.Serialization;

namespace Billing.Api.Application.Statements;

public sealed class JsonStatementFormatter : IStatementFormatter
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    public StatementFormat Format => StatementFormat.Json;

    public string ContentType => "application/json";

    public byte[] Render(Statement statement, StatementRenderOptions options) =>
        JsonSerializer.SerializeToUtf8Bytes(new
        {
            customerId = statement.CustomerId.Value,
            from = statement.From,
            to = statement.To,
            lines = statement.Lines.Select(l => new
            {
                invoiceId = l.InvoiceId.Value,
                date = l.Date,
                status = l.Status,
                amountMinor = l.Amount.Minor,
                currency = l.Amount.Currency,
                convertedMinor = l.Converted.Minor,
            }),
            totalMinor = statement.Total.Minor,
            currency = statement.Total.Currency,
        }, Options);
}
