using Billing.Api.Application.Validation;
using FluentValidation;

namespace Billing.Api.Application.Handlers.Subscriptions;

public sealed class ChangeItemPriceValidator : BillingValidator<ChangeItemPriceCommand>
{
    public ChangeItemPriceValidator()
    {
        RuleFor(x => x.NewUnitPriceMinor).GreaterThan(0);
    }
}
