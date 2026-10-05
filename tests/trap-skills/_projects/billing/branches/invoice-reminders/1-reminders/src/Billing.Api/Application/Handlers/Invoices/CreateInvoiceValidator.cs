using Billing.Api.Application.Validation;
using FluentValidation;
using Microsoft.Extensions.Options;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed class CreateInvoiceValidator : BillingValidator<CreateInvoiceCommand>
{
    public CreateInvoiceValidator(IOptions<BillingOptions> options)
    {
        var billing = options.Value;
        RuleFor(x => x.AmountMinor).GreaterThan(0).LessThanOrEqualTo(billing.MaxInvoiceAmountMinor);
        RuleFor(x => x.Currency).Length(3).Must(c => billing.AllowedCurrencies.Contains(c))
            .WithMessage("Currency is not allowed");
    }
}
