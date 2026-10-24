using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Bookings.Api.Auth;

public class ApiKeyAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IOptionsMonitor<ApiKeyOptions> keys,
    IProblemDetailsService problemDetails)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "ApiKey";
    public const string HeaderName = "X-Api-Key";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(HeaderName, out var values) || string.IsNullOrEmpty(values.ToString()))
            return Task.FromResult(AuthenticateResult.NoResult());

        var presented = values.ToString();
        var entry = keys.CurrentValue.Keys.FirstOrDefault(k => k.Key == presented);
        if (entry is null)
            return Task.FromResult(AuthenticateResult.Fail("Unknown API key."));

        var identity = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, entry.UserId),
                new Claim(ClaimTypes.Role, entry.Role)
            ],
            SchemeName);

        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
    }

    protected override Task HandleChallengeAsync(AuthenticationProperties properties) =>
        WriteProblemAsync(StatusCodes.Status401Unauthorized, "Нужен действующий ключ доступа.", "unauthorized");

    protected override Task HandleForbiddenAsync(AuthenticationProperties properties) =>
        WriteProblemAsync(StatusCodes.Status403Forbidden, "Недостаточно прав.", "forbidden");

    private async Task WriteProblemAsync(int status, string title, string code)
    {
        Response.StatusCode = status;
        var problem = new ProblemDetails { Status = status, Title = title };
        problem.Extensions["code"] = code;
        await problemDetails.WriteAsync(new ProblemDetailsContext { HttpContext = Context, ProblemDetails = problem });
    }
}
