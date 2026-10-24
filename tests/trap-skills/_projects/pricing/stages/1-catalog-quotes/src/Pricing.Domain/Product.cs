namespace Pricing.Domain;

public enum Category
{
    Grocery,
    Household,
    Electronics,
}

public sealed class Product
{
    public Product(Guid id, string sku, string name, Category category, decimal basePrice, string supplierId)
    {
        if (string.IsNullOrWhiteSpace(sku)) throw new DomainException("product.sku_required", "SKU обязателен");
        if (basePrice <= 0) throw new DomainException("product.price_positive", "Цена должна быть больше нуля");
        Id = id;
        Sku = sku;
        Name = name;
        Category = category;
        BasePrice = basePrice;
        SupplierId = supplierId;
    }

    public Guid Id { get; }
    public string Sku { get; }
    public string Name { get; private set; }
    public Category Category { get; }
    public decimal BasePrice { get; private set; }
    public string SupplierId { get; }
    public bool IsArchived { get; private set; }

    public void Rename(string name) => Name = name;

    public void ChangePrice(decimal price)
    {
        if (price <= 0) throw new DomainException("product.price_positive", "Цена должна быть больше нуля");
        BasePrice = price;
    }

    public void Archive() => IsArchived = true;
}
