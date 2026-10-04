namespace Shop.Api.Returns;

public sealed class ReturnsOptions
{
    public int WindowDays { get; set; } = 14;
    public int MaxLinesPerRequest { get; set; } = 20;
}
