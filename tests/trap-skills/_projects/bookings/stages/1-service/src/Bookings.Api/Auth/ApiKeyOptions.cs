namespace Bookings.Api.Auth;

public class ApiKeyOptions
{
    public const string SectionName = "Auth";

    public List<ApiKeyEntry> Keys { get; set; } = new();
}

public class ApiKeyEntry
{
    public string Key { get; set; } = "";
    public string UserId { get; set; } = "";
    public string Role { get; set; } = Roles.Member;
}

public static class Roles
{
    public const string Member = "member";
    public const string Admin = "admin";
}
