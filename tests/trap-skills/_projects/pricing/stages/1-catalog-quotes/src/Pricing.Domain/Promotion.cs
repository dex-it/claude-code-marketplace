namespace Pricing.Domain;

/// <summary>Скидка на категорию в часы акции (по местному времени магазина).</summary>
public sealed record Promotion(Guid Id, Category Category, decimal DiscountPercent, TimeOnly From, TimeOnly To);
