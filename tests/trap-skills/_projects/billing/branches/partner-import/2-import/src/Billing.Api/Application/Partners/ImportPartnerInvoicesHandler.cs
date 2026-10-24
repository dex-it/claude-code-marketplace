using System.Globalization;
using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Partners;

public sealed record ImportError(int Index, string Field, string Code, object[] Args);
public sealed record ImportOutcome(IReadOnlyList<InvoiceId> Created, IReadOnlyList<ImportError> Errors);

public sealed class ImportPartnerInvoicesHandler(
    IInvoiceRepository invoices,
    PartnerImportValidator validator,
    TimeProvider clock)
{
    public async Task<ImportOutcome> HandleAsync(Guid partnerId, PartnerImportRequest request, CancellationToken ct)
    {
        var validation = validator.Validate(request);
        if (!validation.IsValid)
            return new ImportOutcome([], validation.Errors.Select(ToImportError).ToList());

        var created = new List<InvoiceId>();
        foreach (var dto in request.Invoices)
        {
            var number = new PartnerInvoiceNumber(dto.ExternalNumber);
            var amount = decimal.Parse(dto.Amount) * (decimal)dto.FxRate;
            var invoice = new Invoice
            {
                Id = InvoiceId.New(),
                CustomerId = new CustomerId(dto.CustomerId),
                Amount = new Money((long)Math.Round(amount * 100, MidpointRounding.ToEven), dto.Currency),
                DueDate = dto.DueDate,
                CreatedAt = clock.GetUtcNow(),
            };
            invoice.Issue();
            await invoices.AddAsync(invoice, ct);
            created.Add(invoice.Id);
        }
        return new ImportOutcome(created, []);
    }

    private static ImportError ToImportError(FluentValidation.Results.ValidationFailure failure)
    {
        var index = 0;
        var open = failure.PropertyName.IndexOf('[');
        if (open >= 0)
            index = int.Parse(failure.PropertyName[(open + 1)..failure.PropertyName.IndexOf(']')], CultureInfo.InvariantCulture);
        var field = failure.PropertyName[(failure.PropertyName.LastIndexOf('.') + 1)..];
        return new ImportError(index, field, failure.ErrorCode, failure.CustomState as object[] ?? []);
    }
}
