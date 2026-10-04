using ConfReg.Models;

namespace ConfReg.Services;

public static class InvoiceBuilder
{
    public const int VatPercent = 20;

    public static Invoice ForGroupOrder(Organization org, Conference conference, TicketType ticket, int quantity, long unitPriceKopecks)
    {
        var amount = unitPriceKopecks * quantity;
        var vat = amount * VatPercent / 100;

        var line = new InvoiceLine(
            $"Участие в конференции «{conference.Title}», билет «{ticket.Name}»",
            quantity,
            unitPriceKopecks,
            amount);

        return new Invoice(org.Inn, org.Kpp, org.Name, new[] { line }, vat, amount + vat);
    }
}
