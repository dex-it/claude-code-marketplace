using Billing.Api.Application.Validation;
using FluentValidation;

namespace Billing.Api.Application.Handlers.CreditNotes;

public sealed class CreateCreditNoteDraftValidator : BillingValidator<CreateCreditNoteDraftCommand>
{
    public CreateCreditNoteDraftValidator()
    {
        RuleFor(x => x.Lines).NotEmpty();
        RuleForEach(x => x.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.Description).NotEmpty();
            line.RuleFor(l => l.AmountMinor).GreaterThan(0);
        });
    }
}
