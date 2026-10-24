using ByteSizes;
using Xunit;

public class ByteSizeTests
{
    [Fact]
    public void PlainBytes() => Assert.Equal(512, ByteSize.Parse("512"));
}
