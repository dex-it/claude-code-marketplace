namespace ByteSizes;

public static class ByteSize
{
    // Размер в байтах целым числом без единицы.
    public static long Parse(string text)
    {
        if (!long.TryParse(text, out var bytes) || bytes < 0)
            throw new FormatException($"bad size: {text}");
        return bytes;
    }
}
