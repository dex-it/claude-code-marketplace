using System.Globalization;
using System.Text.RegularExpressions;

namespace ByteSizes;

public static class ByteSize
{
    private static readonly Dictionary<string, long> Units = new(StringComparer.OrdinalIgnoreCase)
    {
        [""] = 1, ["B"] = 1, ["KB"] = 1000, ["MB"] = 1000L * 1000, ["GB"] = 1000L * 1000 * 1000,
    };

    public static long Parse(string text)
    {
        var m = Regex.Match(text ?? "", @"^(\d+(?:\.\d+)?)\s*([A-Za-z]*)$");
        if (!m.Success || !Units.TryGetValue(m.Groups[2].Value, out var unit))
            throw new FormatException($"bad size: {text}");
        var number = decimal.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
        return (long)decimal.Truncate(number * unit);
    }
}
