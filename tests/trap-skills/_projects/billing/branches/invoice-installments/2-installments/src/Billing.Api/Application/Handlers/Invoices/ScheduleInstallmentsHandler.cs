using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Installments;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record ScheduleInstallmentsCommand(InvoiceId InvoiceId, int Count);

public sealed class ScheduleInstallmentsHandler(
    IInvoiceRepository invoices,
    ScheduleInstallmentsValidator validator,
    InstallmentScheduleBuilder builder,
    InstallmentAuditSampler audit)
{
    public async Task<Result<Installment[]>> HandleAsync(ScheduleInstallmentsCommand command, CancellationToken ct)
    {
        if (validator.Check(command) is { } error)
            return error;

        var invoice = await invoices.FindAsync(command.InvoiceId, ct);
        if (invoice is null)
            return new InvoiceNotFoundError(command.InvoiceId);
        if (invoice.Status != InvoiceStatus.Issued || invoice.Installments.Count > 0)
            return new InvoiceInvalidStateError(invoice.Id, invoice.Status, "split into installments");

        var schedule = builder.Build(invoice, command.Count).ToArray();
        invoice.SetInstallments(schedule);
        await invoices.SaveAsync(invoice, ct);
        await audit.SampleAsync(invoice.Id, schedule, ct);
        return schedule;
    }
}
