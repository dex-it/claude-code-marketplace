namespace Notify.Worker;

public interface IMailSender
{
    Task SendAsync(string to, string subject, string body, CancellationToken ct);
}
