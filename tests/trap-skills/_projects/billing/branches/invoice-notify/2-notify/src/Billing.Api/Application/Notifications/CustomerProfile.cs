namespace Billing.Api.Application.Notifications;

public sealed class CustomerProfile
{
    public required Guid CustomerId { get; init; }
    public required string Name { get; init; }
    public required string Email { get; init; }
    public List<CustomerContact> Contacts { get; } = new();
    public List<CustomerDevice> Devices { get; } = new();
}

public sealed class CustomerContact
{
    public required string Role { get; init; }
    public required string Email { get; init; }
    public required CustomerProfile Owner { get; init; }
}

public sealed record CustomerDevice(string Token, string Platform);
