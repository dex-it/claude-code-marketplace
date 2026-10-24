using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Billing.Api.Domain;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Billing.Api.Infrastructure.Portal;

public sealed class PortalTokens(IOptions<PortalOptions> options, TimeProvider clock)
{
    private readonly JwtSecurityTokenHandler _handler = new();

    public string Issue(Customer customer)
    {
        var o = options.Value;
        var now = clock.GetUtcNow().UtcDateTime;
        var token = new JwtSecurityToken(
            issuer: o.Issuer,
            audience: o.Audience,
            claims: [new Claim(JwtRegisteredClaimNames.Sub, customer.Id.ToString())],
            notBefore: now,
            expires: now.Add(o.TokenLifetime),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(o.SigningKey)), SecurityAlgorithms.HmacSha256));
        return _handler.WriteToken(token);
    }

    // TODO: refresh-токены
    public CustomerId? ReadCustomerId(string bearer)
    {
        if (!_handler.CanReadToken(bearer))
            return null;
        var token = _handler.ReadJwtToken(bearer);
        if (token.ValidTo < clock.GetUtcNow().UtcDateTime)
            return null;
        return Guid.TryParse(token.Subject, out var id) ? new CustomerId(id) : null;
    }
}
