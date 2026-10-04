using System.Net.Mail;
using Billing.Api.Domain;
using Microsoft.Extensions.Options;

namespace Billing.Api.Infrastructure.Mail;

public sealed class AuditMailOptions
{
    public string Host { get; set; } = "";
    public int Port { get; set; } = 25;
    public string From { get; set; } = "";
    public string To { get; set; } = "";
}

public sealed class AuditMailer(IOptions<AuditMailOptions> options)
{
    public async Task SendAsync(InvoiceId invoiceId, IReadOnlyList<Installment> schedule, CancellationToken ct)
    {
        var o = options.Value;
        var body = string.Join('\n', schedule.Select(i => $"{i.Number}. {i.DueDate:yyyy-MM-dd} {i.Amount.Minor} {i.Amount.Currency}"));
        using var smtp = new SmtpClient(o.Host, o.Port);
        using var message = new MailMessage(o.From, o.To, $"Рассрочка по счёту {invoiceId} на проверку", body);
        await smtp.SendMailAsync(message, ct);
    }
}
