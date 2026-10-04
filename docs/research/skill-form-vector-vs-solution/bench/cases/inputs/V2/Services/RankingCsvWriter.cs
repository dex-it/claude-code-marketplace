using System.Text;

namespace GrantDesk.Services;

/// <summary>CSV рейтинга для экспертного совета (RFC 4180, UTF-8 с BOM, чтобы кириллица открывалась в таблицах).</summary>
public static class RankingCsvWriter
{
    private const string Header = "Место,Номер заявки,Название,Заявитель,Балл,Экспертиз,Запрошено,Грант";

    public static byte[] Write(IReadOnlyList<RankingRow> rows)
    {
        var sb = new StringBuilder();
        sb.Append(Header).Append("\r\n");

        foreach (var r in rows)
        {
            var line = $"{r.Place},{r.ApplicationId},{Escape(r.Title)},{Escape(r.ApplicantName)},{r.Score},{r.SubmittedReviews},{r.RequestedAmount},{(r.Funded ? "да" : "нет")}";
            sb.Append(line).Append("\r\n");
        }

        return Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
    }

    private static string Escape(string value) =>
        value.IndexOfAny(new[] { ',', '"', '\r', '\n' }) >= 0
            ? "\"" + value.Replace("\"", "\"\"") + "\""
            : value;
}
