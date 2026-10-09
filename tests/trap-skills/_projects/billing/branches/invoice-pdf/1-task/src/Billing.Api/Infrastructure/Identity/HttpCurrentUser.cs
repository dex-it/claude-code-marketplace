using Billing.Api.Application.Abstractions;

namespace Billing.Api.Infrastructure.Identity;

public sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public string Id => accessor.HttpContext?.User.FindFirst("sub")?.Value
        ?? throw new InvalidOperationException("No authenticated user in the current request");
}
