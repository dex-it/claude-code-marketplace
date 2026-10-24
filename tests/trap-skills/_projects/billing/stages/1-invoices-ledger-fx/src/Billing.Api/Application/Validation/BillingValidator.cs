using Billing.Api.Domain;
using FluentValidation;

namespace Billing.Api.Application.Validation;

public abstract class BillingValidator<T> : AbstractValidator<T>
{
    protected BillingValidator() => RuleLevelCascadeMode = CascadeMode.Stop;

    public BillingError? Check(T command)
    {
        var result = Validate(command);
        if (result.IsValid)
            return null;
        var first = result.Errors[0];
        return new ValidationError(first.PropertyName, first.ErrorMessage);
    }
}
