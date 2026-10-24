using System.Security.Claims;

namespace Bookings.Api.Auth;

public static class ClaimsPrincipalExtensions
{
    public static string UserId(this ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier) ?? throw new InvalidOperationException("Пользователь не аутентифицирован.");

    public static bool IsAdmin(this ClaimsPrincipal user) => user.IsInRole(Roles.Admin);
}
