using MailKit.Net.Smtp;
using Microsoft.Extensions.Options;
using MimeKit;
using Notify.Worker.Options;

namespace Notify.Worker;

public class SmtpMailSender(IOptions<SmtpOptions> options) : IMailSender
{
    public async Task SendAsync(string to, string subject, string body, CancellationToken ct)
    {
        var o = options.Value;
        var msg = new MimeMessage();
        msg.From.Add(MailboxAddress.Parse(o.FromAddress));
        msg.To.Add(MailboxAddress.Parse(to));
        msg.Subject = subject;
        msg.Body = new TextPart("html") { Text = body };

        using var client = new SmtpClient();
        await client.ConnectAsync(o.Host, o.Port, cancellationToken: ct);
        if (!string.IsNullOrEmpty(o.UserName))
            await client.AuthenticateAsync(o.UserName, o.Password, ct);
        await client.SendAsync(msg, ct);
        await client.DisconnectAsync(true, ct);
    }
}
