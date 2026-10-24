using Billing.Api.Application.Validation;
using Billing.Api.Infrastructure.Configuration;
using FluentValidation;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed class ScheduleInstallmentsValidator : BillingValidator<ScheduleInstallmentsCommand>
{
    public ScheduleInstallmentsValidator()
    {
        RuleFor(x => x.Count).InclusiveBetween(2, BillingConfig.GetInt("Installments:MaxCount", 6));
    }
}
