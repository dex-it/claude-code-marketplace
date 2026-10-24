using System.Globalization;
using System.Text.RegularExpressions;

namespace Tarif.Billing;

public record StatementLine(string BankRef, DateOnly PaidOn, decimal Amount, string PayerName, string Purpose);

public static class BankStatement
{
    // Выгрузка интернет-банка, только входящие: ref;дата;сумма;плательщик;назначение
    // A-77120931;01.10.2026;850,00;Иванова Мария Петровна;Оплата по дог. 12-004518 за октябрь
    public static List<StatementLine> Parse(TextReader reader)
    {
        var ru = CultureInfo.GetCultureInfo("ru-RU");
        var lines = new List<StatementLine>();

        while (reader.ReadLine() is { } raw)
        {
            if (string.IsNullOrWhiteSpace(raw))
                continue;

            var f = raw.Split(';', 5);
            lines.Add(new StatementLine(
                f[0].Trim(),
                DateOnly.ParseExact(f[1].Trim(), "dd.MM.yyyy", ru),
                decimal.Parse(f[2].Trim(), ru),
                f[3].Trim(),
                f[4].Trim()));
        }

        return lines;
    }
}

public static class PaymentPurpose
{
    private static readonly Regex ContractNoPattern = new(@"\b(\d{2}-\d{6})\b", RegexOptions.Compiled);

    // «Оплата по дог. 12-004518 за октябрь» -> «12-004518»
    public static string? ExtractContractNo(string purpose)
    {
        var m = ContractNoPattern.Match(purpose);
        return m.Success ? m.Groups[1].Value : null;
    }
}
