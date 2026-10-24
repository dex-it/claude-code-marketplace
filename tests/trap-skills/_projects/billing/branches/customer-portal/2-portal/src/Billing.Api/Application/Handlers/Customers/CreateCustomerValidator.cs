using Billing.Api.Application.Validation;
using FluentValidation;

namespace Billing.Api.Application.Handlers.Customers;

public sealed class CreateCustomerValidator : BillingValidator<CreateCustomerCommand>
{
    public CreateCustomerValidator()
    {
        RuleFor(x => x.Email).EmailAddress();
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Password).MinimumLength(8);
        RuleFor(x => x.CreditLimitMinor).GreaterThanOrEqualTo(0);
    }
}
