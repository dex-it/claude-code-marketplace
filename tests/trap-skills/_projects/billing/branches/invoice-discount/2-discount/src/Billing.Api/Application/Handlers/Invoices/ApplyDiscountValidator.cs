using Billing.Api.Application.Validation;
using FluentValidation;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed class ApplyDiscountValidator : BillingValidator<ApplyDiscountCommand>
{
    public ApplyDiscountValidator()
    {
        RuleFor(x => x.AmountMinor).GreaterThan(0);
    }
}
