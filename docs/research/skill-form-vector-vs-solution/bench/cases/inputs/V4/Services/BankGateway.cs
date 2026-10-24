using System.Net.Sockets;
using Microsoft.Extensions.Options;
using Renci.SshNet;
using Renci.SshNet.Common;

namespace HoneyCoop.Services;

public sealed class BankSftpOptions
{
    public string Host { get; set; } = "";
    public int Port { get; set; } = 22;
    public string User { get; set; } = "";
    public string KeyPath { get; set; } = "";
    public string UploadDir { get; set; } = "/in";
}

public interface IBankGateway
{
    /// <summary>
    /// Кладёт файл реестра в каталог входящих на SFTP банка; банк забирает его и проводит платежи.
    /// Бросает <see cref="BankGatewayException"/>, если SFTP недоступен или файл не принят.
    /// </summary>
    Task UploadRegistryAsync(string fileName, byte[] content, CancellationToken ct);
}

public class BankGatewayException : Exception
{
    public BankGatewayException(string message, Exception? inner = null) : base(message, inner)
    {
    }
}

public sealed class SftpBankGateway : IBankGateway
{
    private readonly BankSftpOptions _options;

    public SftpBankGateway(IOptions<BankSftpOptions> options)
    {
        _options = options.Value;
    }

    public async Task UploadRegistryAsync(string fileName, byte[] content, CancellationToken ct)
    {
        try
        {
            using var key = new PrivateKeyFile(_options.KeyPath);
            using var client = new SftpClient(_options.Host, _options.Port, _options.User, key);
            await client.ConnectAsync(ct);

            using var stream = new MemoryStream(content);
            await Task.Run(() => client.UploadFile(stream, $"{_options.UploadDir}/{fileName}", canOverride: false), ct);
        }
        catch (Exception ex) when (ex is SshException or SocketException or IOException)
        {
            throw new BankGatewayException($"Не удалось передать {fileName} на SFTP банка", ex);
        }
    }
}
