namespace Billing.Api.Domain;

public sealed class Customer
{
    public required CustomerId Id { get; init; }
    public required string Email { get; set; }
    public required string Name { get; set; }
    public string PasswordHash { get; set; } = "";
    public long CreditLimitMinor { get; set; }
    public bool IsVerified { get; set; }
}
