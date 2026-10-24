using System.Globalization;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Mail;

namespace Billing.Api.Application.Installments;

public sealed class InstallmentAuditSampler(AuditMailer mailer)
{
    private const double DefaultRate = 0.05;

    public async Task SampleAsync(InvoiceId invoiceId, IReadOnlyList<Installment> schedule, CancellationToken ct)
    {
        var rate = double.TryParse(
            Environment.GetEnvironmentVariable("INSTALLMENTS_AUDIT_RATE"),
            NumberStyles.Float,
            CultureInfo.InvariantCulture,
            out var configured)
            ? configured
            : DefaultRate;

        if (Random.Shared.NextDouble() < rate)
            await mailer.SendAsync(invoiceId, schedule, ct);
    }
}
