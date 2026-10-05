using Billing.Api.Application.Subscriptions;
using Billing.Api.Application.Validation;
using FluentValidation;

namespace Billing.Api.Application.Handlers.Subscriptions;

public sealed class CreateSubscriptionValidator : BillingValidator<CreateSubscriptionCommand>
{
    public CreateSubscriptionValidator()
    {
        RuleFor(x => x.Currency).Length(3);
        RuleFor(x => x.Items).NotEmpty();
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.Service).Must(s => PlanCatalog.Prices.ContainsKey(s)).WithMessage("unknown service");
            item.RuleFor(i => i.Quantity).GreaterThan(0);
            item.RuleFor(i => i.IncludedUnits).GreaterThanOrEqualTo(0);
        });
        RuleFor(x => x.MonthlyTotalMinor).GreaterThan(0);
    }
}
