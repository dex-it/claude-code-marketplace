using Billing.Api.Application.Validation;
using FluentValidation;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed class CreateInvoiceValidator : BillingValidator<CreateInvoiceCommand>
{
    public CreateInvoiceValidator()
    {
        RuleFor(x => x.AmountMinor).GreaterThan(0);
        RuleFor(x => x.Currency).Matches("^[A-Z]{3}$").WithMessage("ISO 4217 code in upper case");
    }
}
