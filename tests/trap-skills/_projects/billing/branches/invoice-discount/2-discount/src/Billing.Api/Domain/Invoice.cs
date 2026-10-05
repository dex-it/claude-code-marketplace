namespace Billing.Api.Domain;

public enum InvoiceStatus { Draft, Issued, Paid, Cancelled }

public sealed class Invoice
{
    public required InvoiceId Id { get; init; }
    public required CustomerId CustomerId { get; init; }
    public required Money Amount { get; init; }
    public required DateOnly DueDate { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
    public InvoiceStatus Status { get; private set; } = InvoiceStatus.Draft;
    public DateTimeOffset? PaidAt { get; private set; }
    public Money? Discount { get; private set; }

    public Money AmountDue => Discount is { } discount ? Amount.Subtract(discount) : Amount;

    public void Issue() => Status = InvoiceStatus.Issued;

    public void MarkPaid(DateTimeOffset at)
    {
        Status = InvoiceStatus.Paid;
        PaidAt = at;
    }

    public void Cancel() => Status = InvoiceStatus.Cancelled;

    public BillingError? ApplyDiscount(Money discount)
    {
        if (Status != InvoiceStatus.Issued)
            return new InvoiceInvalidStateError(Id, Status, "discount");
        if (Discount is not null)
            return new InvoiceDiscountExistsError(Id);
        if (discount.Currency != Amount.Currency)
            return new ValidationError("currency", $"must be {Amount.Currency}");
        if (discount.Minor >= Amount.Minor)
            return new InvoiceDiscountTooLargeError(Id, discount.Minor, Amount.Minor);

        Discount = discount;
        return null;
    }
}
