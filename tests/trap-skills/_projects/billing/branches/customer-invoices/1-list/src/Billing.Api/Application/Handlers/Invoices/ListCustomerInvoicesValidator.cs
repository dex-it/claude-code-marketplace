using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Validation;
using FluentValidation;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed class ListCustomerInvoicesValidator : BillingValidator<ListCustomerInvoicesQuery>
{
    public const int MaxLimit = 100;

    public ListCustomerInvoicesValidator()
    {
        RuleFor(x => x.Limit)
            .InclusiveBetween(1, MaxLimit)
            .When(x => x.Limit is not null)
            .OverridePropertyName("limit")
            .WithMessage($"must be between 1 and {MaxLimit}");

        RuleFor(x => x.Cursor)
            .Must(c => InvoiceCursor.TryParse(c!) is not null)
            .When(x => x.Cursor is not null)
            .OverridePropertyName("cursor")
            .WithMessage("invalid cursor");
    }
}
