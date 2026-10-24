using System.Globalization;
using System.Text;
using System.Text.Json;
using FluentValidation;
using Newtonsoft.Json;

namespace Billing.Api.Application.Partners;

public sealed class PartnerImportValidator : AbstractValidator<PartnerImportRequest>
{
    public PartnerImportValidator()
    {
        RuleFor(x => x).Must(x => Encoding.UTF8.GetByteCount(JsonConvert.SerializeObject(x)) <= PartnerLimits.MaxBodyBytes)
            .WithErrorCode("value.too_long").WithState(_ => new object[] { PartnerLimits.MaxBodyBytes });
        RuleFor(x => x.Invoices).NotEmpty().WithErrorCode("value.required")
            .Must(i => i.Count <= PartnerLimits.MaxInvoices).WithErrorCode("value.too_long").WithState(_ => new object[] { PartnerLimits.MaxInvoices });
        RuleForEach(x => x.Invoices).SetValidator(new PartnerInvoiceValidator());
    }
}

public sealed class PartnerInvoiceValidator : AbstractValidator<PartnerInvoiceDto>
{
    private static readonly CultureInfo Ru = CultureInfo.GetCultureInfo("ru-RU");

    public PartnerInvoiceValidator()
    {
        RuleLevelCascadeMode = CascadeMode.Stop;

        RuleFor(x => x.CustomerId);
        RuleFor(x => x.ExternalNumber).NotEmpty().WithErrorCode("value.required")
            .MaximumLength(256).WithErrorCode("value.too_long").WithState(_ => new object[] { 256 });
        RuleFor(x => x.Description).NotEmpty().WithErrorCode("value.required")
            .MaximumLength(255).WithErrorCode("value.too_long").WithState(_ => new object[] { 255 });
        RuleFor(x => x.Comment!)
            .Must(c => Encoding.UTF8.GetByteCount(System.Text.Json.JsonSerializer.Serialize(c)) <= PartnerLimits.CommentMaxBytes)
            .WithErrorCode("value.too_long").WithState(_ => new object[] { PartnerLimits.CommentMaxBytes })
            .When(x => x.Comment is not null);
        RuleFor(x => x.Amount)
            .Must(a => decimal.TryParse(a, NumberStyles.Number, Ru, out var v) && v >= PartnerLimits.MinAmount && v <= PartnerLimits.MaxAmount)
            .WithErrorCode("amount.range").WithState(_ => new object[] { PartnerLimits.MaxAmount, PartnerLimits.MinAmount });
        RuleFor(x => x.Currency).Length(3).WithErrorCode("value.invalid");
        RuleFor(x => x.FxRate).GreaterThan(0).WithErrorCode("value.invalid");
        RuleFor(x => x.Kind);
    }
}
