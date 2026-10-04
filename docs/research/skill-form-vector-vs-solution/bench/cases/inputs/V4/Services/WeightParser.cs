using System.Globalization;

namespace HoneyCoop.Services;

/// <summary>Разбор веса в формате весов: килограммы с запятой и тремя знаками, например "41,250".</summary>
public static class WeightParser
{
    private static readonly NumberFormatInfo ScaleFormat = new() { NumberDecimalSeparator = ",", NumberGroupSeparator = " " };

    public static bool TryParseKg(string raw, out decimal kg) =>
        decimal.TryParse(raw.Trim(), NumberStyles.AllowDecimalPoint, ScaleFormat, out kg) && kg > 0;
}
