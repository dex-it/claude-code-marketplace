namespace Pricing.Domain;

public class DomainException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

public sealed class NotFoundException(string code, string message) : DomainException(code, message);
