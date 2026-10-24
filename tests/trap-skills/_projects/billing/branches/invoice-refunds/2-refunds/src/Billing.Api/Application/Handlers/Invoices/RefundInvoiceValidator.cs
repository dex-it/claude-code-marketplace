using Billing.Api.Application.Validation;
using FluentValidation;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed class RefundInvoiceValidator : BillingValidator<RefundInvoiceCommand>
{
    public RefundInvoiceValidator()
    {
        RuleFor(x => x.AmountMinor).GreaterThan(0);
    }
}
