using Pricing.Domain;

namespace Pricing.Api.Contracts;

public sealed record ActiveDiscountDto(Category Category, decimal DiscountPercent);
