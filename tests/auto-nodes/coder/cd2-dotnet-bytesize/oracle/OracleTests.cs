using System.Globalization;
using ByteSizes;
using Xunit;

public class OracleTests
{
    private static void Bad(string s) => Assert.Contains(s, Assert.Throws<FormatException>(() => ByteSize.Parse(s)).Message);

    [Fact] public void R1_plain() => Assert.Equal(512, ByteSize.Parse("512"));
    [Fact] public void R1_B() => Assert.Equal(512, ByteSize.Parse("512B"));
    [Fact] public void R1_MB() => Assert.Equal(2097152, ByteSize.Parse("2MB"));
    [Fact] public void R1_GB() => Assert.Equal(1073741824, ByteSize.Parse("1GB"));
    [Fact] public void R2_fraction() => Assert.Equal(1536, ByteSize.Parse("1.5KB"));
    [Fact] public void R2_truncate() => Assert.Equal(1945, ByteSize.Parse("1.9KB"));
    [Fact] public void R3_case_space() => Assert.Equal(1024, ByteSize.Parse("1 kb"));
    [Fact] public void R3_case() => Assert.Equal(2097152, ByteSize.Parse("2mB"));
    [Fact] public void R4_empty() => Assert.Throws<FormatException>(() => ByteSize.Parse(""));
    [Fact] public void R4_negative() => Bad("-1KB");
    [Fact] public void R4_unknown() => Bad("5TB");

    [Fact]
    public void Hidden_culture_ru()
    {
        var was = CultureInfo.CurrentCulture;
        CultureInfo.CurrentCulture = new CultureInfo("ru-RU");
        try { Assert.Equal(1536, ByteSize.Parse("1.5KB")); }
        finally { CultureInfo.CurrentCulture = was; }
    }

    [Fact]
    public void Hidden_culture_invariant()
    {
        var was = CultureInfo.CurrentCulture;
        CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
        try { Assert.Equal(1536, ByteSize.Parse("1.5KB")); }
        finally { CultureInfo.CurrentCulture = was; }
    }
}
