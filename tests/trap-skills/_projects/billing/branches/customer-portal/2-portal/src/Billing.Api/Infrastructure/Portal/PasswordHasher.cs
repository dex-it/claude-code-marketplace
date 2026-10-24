using System.Security.Cryptography;
using System.Text;

namespace Billing.Api.Infrastructure.Portal;

public static class PasswordHasher
{
    public static string Hash(string password) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(password)));

    public static bool Verify(string password, string hash) =>
        CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(Hash(password)), Encoding.ASCII.GetBytes(hash));
}
