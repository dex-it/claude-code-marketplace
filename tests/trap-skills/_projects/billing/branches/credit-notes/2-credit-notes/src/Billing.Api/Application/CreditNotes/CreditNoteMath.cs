using Billing.Api.Domain;

namespace Billing.Api.Application.CreditNotes;

public static class CreditNoteMath
{
    public const decimal VatRate = 0.20m;

    public static long Gross(IEnumerable<CreditNoteLine> lines) => lines.Sum(l => l.AmountMinor);

    public static decimal Vat(long grossMinor) => grossMinor * VatRate;

    public static long RoundToMinor(decimal amountMinor) => (long)Math.Round(amountMinor, MidpointRounding.ToEven);
}

public sealed record CreditNoteIssued(Guid CreditNoteId);
