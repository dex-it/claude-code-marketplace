using Billing.Api.Application.Validation;
using FluentValidation;

namespace Billing.Api.Application.Handlers.Statements;

public sealed class BuildStatementValidator : BillingValidator<BuildStatementQuery>
{
    public BuildStatementValidator()
    {
        RuleFor(x => x.Currency).Length(3);
        RuleFor(x => x.To).GreaterThanOrEqualTo(x => x.From);
    }
}
